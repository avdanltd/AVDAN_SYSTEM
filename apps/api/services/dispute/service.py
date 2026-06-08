"""Dispute service — raise, review, and resolve order disputes."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AppError, ForbiddenException, NotFoundException, ValidationException
from services.dispute.models import Dispute
from services.dispute.schemas import RaiseDisputeRequest, ResolveDisputeRequest
from services.orders.models import Order
from services.orders.service import OrderService
from services.orders.state_machine import OrderStatus
from services.payment.models import EscrowStatus, EscrowTransaction


class DisputeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def raise_dispute(
        self, user_id: str, user_role: str, data: RaiseDisputeRequest
    ) -> Dispute:
        order = await self._get_order(data.order_id)

        # Only customer or vendor party to the order may raise a dispute
        from services.vendor.models import Vendor
        vendor_result = await self.db.execute(
            select(Vendor).where(Vendor.id == order.vendor_id)
        )
        vendor = vendor_result.scalar_one_or_none()
        vendor_user_id = str(vendor.user_id) if vendor else None

        is_customer = user_role == "customer" and str(order.customer_id) == user_id
        is_vendor = user_role == "vendor" and vendor_user_id == user_id
        if not (is_customer or is_vendor):
            raise ForbiddenException("Only the order customer or vendor may raise a dispute")

        if order.status != OrderStatus.DELIVERED:
            raise AppError(
                400, "INVALID_STATE",
                f"Disputes can only be raised on DELIVERED orders (current: {order.status})"
            )

        # Transition order to DISPUTED — this also freezes escrow naturally
        # (PAYMENT_RELEASE_PENDING auto-release only triggers on that status, not DISPUTED)
        order_svc = OrderService(self.db)
        await order_svc.transition(
            data.order_id, OrderStatus.DISPUTED, user_id, user_role,
            metadata={"reason": data.reason},
        )

        dispute = Dispute(
            order_id=uuid.UUID(data.order_id),
            raised_by=uuid.UUID(user_id),
            reason=data.reason,
            description=data.description,
            evidence_urls=data.evidence_urls,
            status="open",
        )
        self.db.add(dispute)
        await self.db.flush()
        return dispute

    async def list_own_disputes(
        self, user_id: str, page: int, page_size: int
    ) -> tuple[list[Dispute], int]:
        user_uuid = uuid.UUID(user_id)
        count_result = await self.db.execute(
            select(func.count()).select_from(Dispute).where(
                Dispute.raised_by == user_uuid
            )
        )
        total = count_result.scalar_one()
        offset = (page - 1) * page_size
        result = await self.db.execute(
            select(Dispute)
            .where(Dispute.raised_by == user_uuid)
            .order_by(Dispute.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def resolve_dispute(
        self, dispute_id: str, admin_id: str, data: ResolveDisputeRequest
    ) -> Dispute:
        dispute = await self._get_dispute(dispute_id)
        if dispute.status == "resolved":
            raise AppError(400, "ALREADY_RESOLVED", "Dispute is already resolved")

        order = await self._get_order(str(dispute.order_id))
        escrow = await self._get_escrow(str(order.id))

        if data.resolution == "split":
            if not data.vendor_amount_kobo or not data.refund_amount_kobo:
                raise ValidationException(
                    "vendor_amount_kobo and refund_amount_kobo are required for split resolution"
                )
            total = data.vendor_amount_kobo + data.refund_amount_kobo
            if escrow and total > escrow.amount_kobo:
                raise ValidationException(
                    "Split amounts exceed original payment amount"
                )

        # 1. Transition order: DISPUTED → DISPUTE_RESOLVED (admin)
        order_svc = OrderService(self.db)
        await order_svc.transition(
            str(order.id), OrderStatus.DISPUTE_RESOLVED, admin_id, "admin",
            metadata={"resolution": data.resolution, "notes": data.notes},
        )

        # 2. Execute money action then advance order state
        from services.payment.service import PaymentService
        payment_svc = PaymentService(self.db)

        if data.resolution == "release_to_vendor":
            await payment_svc.release_escrow(str(order.id))

        elif data.resolution == "refund_to_customer":
            if escrow:
                await payment_svc.process_refund(
                    str(order.id), escrow.amount_kobo, admin_id, data.notes
                )
            else:
                await order_svc.transition(
                    str(order.id), OrderStatus.REFUND_INITIATED, admin_id, "system"
                )

        elif data.resolution == "split":
            # Transfer vendor portion
            from services.vendor.models import Vendor
            vendor_result = await self.db.execute(
                select(Vendor).where(Vendor.id == order.vendor_id)
            )
            vendor = vendor_result.scalar_one_or_none()
            if vendor and vendor.paystack_recipient_code and escrow:
                from services.payment.providers.registry import get_provider
                provider = get_provider(escrow.provider)
                transfer_ref = f"split-vendor-{order.id}"
                await provider.transfer_to_vendor(
                    vendor.paystack_recipient_code,
                    data.vendor_amount_kobo,  # type: ignore[arg-type]
                    transfer_ref,
                )
                # Refund customer portion
                await provider.refund(escrow.provider_ref, data.refund_amount_kobo)  # type: ignore[arg-type]
                if escrow:
                    escrow.status = EscrowStatus.RELEASED
            # Advance order to PAYMENT_RELEASED
            await order_svc.transition(
                str(order.id), OrderStatus.PAYMENT_RELEASED, None, "system"
            )
            await order_svc.transition(
                str(order.id), OrderStatus.COMPLETED, None, "system"
            )

        # 3. Update dispute record
        dispute.status = "resolved"
        dispute.resolution = data.resolution
        dispute.resolution_notes = data.notes
        dispute.resolved_by = uuid.UUID(admin_id)
        dispute.resolved_at = datetime.now(UTC)
        return dispute

    # ── Admin helpers ─────────────────────────────────────────────────────────

    async def list_all_disputes(
        self, status: str | None, page: int, page_size: int
    ) -> tuple[list[Dispute], int]:
        query = select(Dispute)
        count_query = select(func.count()).select_from(Dispute)
        if status:
            query = query.where(Dispute.status == status)
            count_query = count_query.where(Dispute.status == status)
        total = (await self.db.execute(count_query)).scalar_one()
        offset = (page - 1) * page_size
        result = await self.db.execute(
            query.order_by(Dispute.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_dispute_detail(self, dispute_id: str) -> Dispute:
        return await self._get_dispute(dispute_id)

    # ── Private ───────────────────────────────────────────────────────────────

    async def _get_order(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order).where(Order.id == uuid.UUID(order_id))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        return order

    async def _get_dispute(self, dispute_id: str) -> Dispute:
        result = await self.db.execute(
            select(Dispute).where(Dispute.id == uuid.UUID(dispute_id))
        )
        dispute = result.scalar_one_or_none()
        if not dispute:
            raise NotFoundException("Dispute not found")
        return dispute

    async def _get_escrow(self, order_id: str) -> EscrowTransaction | None:
        result = await self.db.execute(
            select(EscrowTransaction).where(
                EscrowTransaction.order_id == uuid.UUID(order_id)
            )
        )
        return result.scalar_one_or_none()
