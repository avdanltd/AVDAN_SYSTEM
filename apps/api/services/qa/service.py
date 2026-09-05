"""QA / Agent Hub service."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.exceptions import AppError, ForbiddenException, NotFoundException
from services.orders.models import Order, OrderEvent
from services.orders.service import OrderService
from services.orders.state_machine import OrderStatus
from services.qa.models import AgentHub, QAInspection
from services.qa.schemas import QAFailRequest


class QAService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Hub resolution ────────────────────────────────────────────────────────

    async def get_hub_for_agent(self, agent_user_id: str) -> AgentHub:
        from services.auth.models import User
        result = await self.db.execute(
            select(User).where(User.id == uuid.UUID(agent_user_id))
        )
        user = result.scalar_one_or_none()
        if not user or not user.hub_id:
            raise AppError(422, "HUB_NOT_ASSIGNED", "This agent is not assigned to a hub")

        hub_result = await self.db.execute(
            select(AgentHub).where(AgentHub.id == user.hub_id, AgentHub.active.is_(True))
        )
        hub = hub_result.scalar_one_or_none()
        if not hub:
            raise NotFoundException("Agent hub not found or inactive")
        return hub

    # ── Order operations ──────────────────────────────────────────────────────

    async def list_inbound_orders(
        self, agent_user_id: str, page: int, page_size: int, status_filter: list[str] | None = None
    ) -> tuple[list[Order], int]:
        from sqlalchemy import or_
        hub = await self.get_hub_for_agent(agent_user_id)

        # Dispatch now pre-assigns hub_id the moment a rider is assigned (READY_FOR_PICKUP),
        # so a hub sees an order as "incoming" well before it physically arrives. The
        # hub_id IS NULL branch is a safety net only — it covers orders that reached
        # IN_TRANSIT_TO_HUB without ever getting a hub (no active hub existed at assignment
        # time), which any hub can still self-claim, same as the original behaviour.
        hub_filter = or_(
            (Order.status == OrderStatus.IN_TRANSIT_TO_HUB) & Order.hub_id.is_(None),
            Order.hub_id == hub.id,
        )
        active_statuses = status_filter or [
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT_TO_HUB,
            OrderStatus.AT_HUB,
            OrderStatus.QA_IN_PROGRESS,
            OrderStatus.QA_PASSED,
            OrderStatus.QA_FAILED,
            OrderStatus.VENDOR_REMEDIATION,
        ]
        base_filter = hub_filter & Order.status.in_(active_statuses)

        count_result = await self.db.execute(
            select(func.count()).select_from(Order).where(base_filter)
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            select(Order)
            .where(base_filter)
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_order_for_agent(self, agent_user_id: str, order_id: str) -> Order:
        hub = await self.get_hub_for_agent(agent_user_id)
        result = await self.db.execute(
            select(Order)
            .where(Order.id == uuid.UUID(order_id))
            .options(selectinload(Order.items))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        # Allow access to orders in transit (hub_id not yet set) or already at this hub
        if order.hub_id and order.hub_id != hub.id:
            raise ForbiddenException("Order belongs to a different hub")
        return order

    async def receive_order(self, agent_user_id: str, order_id: str) -> Order:
        """IN_TRANSIT_TO_HUB → AT_HUB → QA_IN_PROGRESS (two transitions, one request)."""
        hub = await self.get_hub_for_agent(agent_user_id)
        order = await self._get_order(order_id)

        # Dispatch pre-assigns hub_id when the rider is assigned (see DispatchService._pick_hub).
        # Reject the receive if this order was routed to a different hub — without this check any
        # agent could silently steal/misroute a pre-assigned order. A null hub_id is still
        # allowed to be claimed here: the safety-net path for when no active hub existed yet.
        if order.hub_id and order.hub_id != hub.id:
            raise ForbiddenException("Order belongs to a different hub")

        order_svc = OrderService(self.db)
        await order_svc.transition(order_id, OrderStatus.AT_HUB, agent_user_id, "agent")

        # Stamp hub on order (no-op if already pre-assigned to this hub)
        order.hub_id = hub.id

        await order_svc.transition(order_id, OrderStatus.QA_IN_PROGRESS, agent_user_id, "agent")

        # Create pending QA inspection record
        self.db.add(QAInspection(
            order_id=uuid.UUID(order_id),
            agent_id=uuid.UUID(agent_user_id),
            hub_id=hub.id,
            result="pending",
        ))
        await self.db.flush()
        return await self._reload(order_id)

    async def qa_pass(self, agent_user_id: str, order_id: str) -> Order:
        """QA_IN_PROGRESS → QA_PASSED → OUT_FOR_DELIVERY (two transitions, one request)."""
        hub = await self.get_hub_for_agent(agent_user_id)
        await self._assert_agent_hub_owns_order(hub, order_id)

        order_svc = OrderService(self.db)
        await order_svc.transition(order_id, OrderStatus.QA_PASSED, agent_user_id, "agent")
        await order_svc.transition(order_id, OrderStatus.OUT_FOR_DELIVERY, agent_user_id, "agent")

        await self._update_inspection(order_id, agent_user_id, hub.id, "pass")
        return await self._reload(order_id)

    async def qa_fail(
        self, agent_user_id: str, order_id: str, data: QAFailRequest
    ) -> Order:
        hub = await self.get_hub_for_agent(agent_user_id)
        await self._assert_agent_hub_owns_order(hub, order_id)

        order_svc = OrderService(self.db)
        await order_svc.transition(
            order_id,
            OrderStatus.QA_FAILED,
            agent_user_id,
            "agent",
            metadata={"notes": data.notes},
        )
        await self._update_inspection(
            order_id, agent_user_id, hub.id, "fail",
            notes=data.notes,
            evidence_urls=data.evidence_urls,
        )
        return await self._reload(order_id)

    async def add_evidence_url(
        self, agent_user_id: str, order_id: str, url: str
    ) -> None:
        hub = await self.get_hub_for_agent(agent_user_id)
        result = await self.db.execute(
            select(QAInspection).where(
                QAInspection.order_id == uuid.UUID(order_id),
                QAInspection.hub_id == hub.id,
            )
        )
        inspection = result.scalar_one_or_none()
        if inspection:
            current = list(inspection.evidence_urls or [])
            current.append(url)
            inspection.evidence_urls = current

    # ── Analytics ─────────────────────────────────────────────────────────────

    async def get_hub_analytics(
        self, agent_user_id: str, period_days: int = 7
    ) -> dict:
        hub = await self.get_hub_for_agent(agent_user_id)

        total_result = await self.db.execute(
            select(func.count()).select_from(QAInspection).where(
                QAInspection.hub_id == hub.id
            )
        )
        total = total_result.scalar_one()

        pass_result = await self.db.execute(
            select(func.count()).select_from(QAInspection).where(
                QAInspection.hub_id == hub.id,
                QAInspection.result == "pass",
            )
        )
        pass_count = pass_result.scalar_one()

        fail_result = await self.db.execute(
            select(func.count()).select_from(QAInspection).where(
                QAInspection.hub_id == hub.id,
                QAInspection.result == "fail",
            )
        )
        fail_count = fail_result.scalar_one()

        pass_rate = round((pass_count / total * 100), 2) if total > 0 else 0.0

        # Average dwell time: time between AT_HUB and OUT_FOR_DELIVERY events
        dwell_result = await self.db.execute(
            select(
                func.avg(
                    func.extract(
                        "epoch",
                        func.max(OrderEvent.created_at) - func.min(OrderEvent.created_at),
                    )
                )
            ).select_from(OrderEvent)
            .join(Order, Order.id == OrderEvent.order_id)
            .where(
                Order.hub_id == hub.id,
                OrderEvent.to_state.in_([OrderStatus.AT_HUB, OrderStatus.OUT_FOR_DELIVERY]),
            )
            .group_by(OrderEvent.order_id)
        )
        avg_seconds = dwell_result.scalar_one_or_none()
        avg_dwell_minutes = round(float(avg_seconds) / 60, 1) if avg_seconds else None

        return {
            "hub_id": str(hub.id),
            "hub_name": hub.name,
            "period_days": period_days,
            "orders_processed": total,
            "qa_pass_count": pass_count,
            "qa_fail_count": fail_count,
            "qa_pass_rate_pct": pass_rate,
            "avg_dwell_minutes": avg_dwell_minutes,
        }

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get_order(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order).where(Order.id == uuid.UUID(order_id))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        return order

    async def _reload(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order)
            .where(Order.id == uuid.UUID(order_id))
            .options(selectinload(Order.items))
        )
        return result.scalar_one()

    async def _assert_agent_hub_owns_order(self, hub: AgentHub, order_id: str) -> None:
        order = await self._get_order(order_id)
        if order.hub_id and order.hub_id != hub.id:
            raise ForbiddenException("This order is not at your hub")

    async def _update_inspection(
        self,
        order_id: str,
        agent_id: str,
        hub_id: uuid.UUID,
        result: str,
        notes: str | None = None,
        evidence_urls: list[str] | None = None,
    ) -> None:
        inspection_result = await self.db.execute(
            select(QAInspection).where(
                QAInspection.order_id == uuid.UUID(order_id),
                QAInspection.hub_id == hub_id,
            )
        )
        inspection = inspection_result.scalar_one_or_none()
        if inspection:
            inspection.result = result
            if notes:
                inspection.notes = notes
            if evidence_urls:
                inspection.evidence_urls = evidence_urls
        else:
            self.db.add(QAInspection(
                order_id=uuid.UUID(order_id),
                agent_id=uuid.UUID(agent_id),
                hub_id=hub_id,
                result=result,
                notes=notes,
                evidence_urls=evidence_urls or [],
            ))
        await self.db.flush()
