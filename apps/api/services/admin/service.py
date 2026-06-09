"""Admin service — user management operations."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from core.exceptions import NotFoundException
from services.auth.models import User
from services.orders.models import Order, OrderEvent
from services.vendor.models import Vendor


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_users(
        self,
        role: str | None,
        status: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[User], int]:
        query = select(User)
        count_query = select(func.count()).select_from(User)

        if role:
            query = query.where(User.role == role)
            count_query = count_query.where(User.role == role)
        if status:
            query = query.where(User.status == status)
            count_query = count_query.where(User.status == status)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        offset = (page - 1) * page_size
        query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
        result = await self.db.execute(query)
        users = list(result.scalars().all())

        return users, total

    async def update_user_status(self, user_id: str, new_status: str) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))  # type: ignore[arg-type]
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundException("User not found")

        user.status = new_status
        return user

    # ── Vendor management ─────────────────────────────────────────────────────

    async def list_vendors(
        self,
        status: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Vendor], int]:
        query = select(Vendor)
        count_query = select(func.count()).select_from(Vendor)

        if status:
            query = query.where(Vendor.status == status)
            count_query = count_query.where(Vendor.status == status)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        offset = (page - 1) * page_size
        query = query.order_by(Vendor.created_at.desc()).offset(offset).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def update_vendor_status(self, vendor_id: str, new_status: str) -> Vendor:
        result = await self.db.execute(
            select(Vendor).where(Vendor.id == uuid.UUID(vendor_id))
        )
        vendor = result.scalar_one_or_none()
        if not vendor:
            raise NotFoundException("Vendor not found")

        vendor.status = new_status
        return vendor

    # ── Order management ──────────────────────────────────────────────────────

    async def list_orders(
        self,
        status: str | None,
        vendor_id: str | None,
        customer_id: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Order], int]:
        query = select(Order)
        count_query = select(func.count()).select_from(Order)

        if status:
            query = query.where(Order.status == status)
            count_query = count_query.where(Order.status == status)
        if vendor_id:
            query = query.where(Order.vendor_id == uuid.UUID(vendor_id))
            count_query = count_query.where(Order.vendor_id == uuid.UUID(vendor_id))
        if customer_id:
            query = query.where(Order.customer_id == uuid.UUID(customer_id))
            count_query = count_query.where(Order.customer_id == uuid.UUID(customer_id))

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            query
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_order_detail(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order)
            .where(Order.id == uuid.UUID(order_id))
            .options(selectinload(Order.items), selectinload(Order.events))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        return order

    # ── Hub management ────────────────────────────────────────────────────────

    async def list_hubs(self) -> list:
        from services.qa.models import AgentHub
        result = await self.db.execute(select(AgentHub).order_by(AgentHub.name))
        return list(result.scalars().all())

    async def create_hub(self, name: str, capacity: int, lat: float | None, lng: float | None):
        from services.qa.models import AgentHub
        hub = AgentHub(name=name, capacity=capacity, lat=lat, lng=lng)
        self.db.add(hub)
        await self.db.flush()
        await self.db.refresh(hub)
        return hub

    async def update_hub(self, hub_id: str, name: str, capacity: int):
        from services.qa.models import AgentHub
        import uuid as _uuid
        result = await self.db.execute(
            select(AgentHub).where(AgentHub.id == _uuid.UUID(hub_id))
        )
        hub = result.scalar_one_or_none()
        if not hub:
            raise NotFoundException("Hub not found")
        hub.name = name
        hub.capacity = capacity
        await self.db.flush()
        return hub

    async def delete_hub(self, hub_id: str) -> None:
        from services.qa.models import AgentHub
        import uuid as _uuid
        result = await self.db.execute(
            select(AgentHub).where(AgentHub.id == _uuid.UUID(hub_id))
        )
        hub = result.scalar_one_or_none()
        if not hub:
            raise NotFoundException("Hub not found")
        # Unassign any agents pointing to this hub
        agent_result = await self.db.execute(
            select(User).where(User.hub_id == hub.id)
        )
        for agent in agent_result.scalars().all():
            agent.hub_id = None
        await self.db.delete(hub)
        await self.db.flush()

    async def assign_agent_hub(self, user_id: str, hub_id: str | None) -> User:
        import uuid as _uuid
        result = await self.db.execute(select(User).where(User.id == user_id))  # type: ignore[arg-type]
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundException("User not found")
        user.hub_id = _uuid.UUID(hub_id) if hub_id else None
        await self.db.flush()
        return user

    async def override_order_status(
        self, order_id: str, new_status: str, reason: str, admin_id: str
    ) -> Order:
        result = await self.db.execute(
            select(Order).where(Order.id == uuid.UUID(order_id))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")

        self.db.add(
            OrderEvent(
                order_id=order.id,
                from_state=order.status,
                to_state=new_status,
                actor_id=uuid.UUID(admin_id),
                actor_role="admin",
                event_metadata={"reason": reason, "manual_override": True},
            )
        )
        order.status = new_status
        await self.db.flush()
        return order
