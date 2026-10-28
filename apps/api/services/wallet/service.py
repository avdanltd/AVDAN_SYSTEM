"""Wallet service — the single place money balances and payout requests are computed.

Earnings are credited to a ledger (WalletEntry) when work is done; nothing is ever sent to a bank
until a vendor/rider requests a withdrawal and an admin approves an amount. See
WALLET_PAYOUTS.md (repo root) for the money states and how each is derived.
"""
from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AppError, NotFoundException
from services.orders.models import Order
from services.orders.state_machine import OrderStatus
from services.wallet.models import (
    PayoutEventType,
    PayoutRequest,
    PayoutRequestEvent,
    PayoutStatus,
    WalletEntry,
    WalletEntryKind,
    WalletOwner,
)

logger = logging.getLogger(__name__)

# Order states that count as "ongoing" money — paid for, but the goods have not been delivered yet.
_ONGOING_STATES = [
    OrderStatus.PAID,
    OrderStatus.VENDOR_ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.PICKED_UP,
    OrderStatus.IN_TRANSIT_TO_HUB,
    OrderStatus.ARRIVED_AT_HUB,
    OrderStatus.AT_HUB,
    OrderStatus.QA_IN_PROGRESS,
    OrderStatus.QA_PASSED,
    OrderStatus.QA_FAILED,
    OrderStatus.VENDOR_REMEDIATION,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.FAILED_DELIVERY,
]
# Rider's pay is earned the moment the parcel is delivered; the vendor's waits out the dispute window.
_VENDOR_CLEARING_STATES = [OrderStatus.DELIVERED, OrderStatus.PAYMENT_RELEASE_PENDING]


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


class WalletService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Owner resolution ──────────────────────────────────────────────────────

    async def _get_owner(self, owner_type: str, user_id: str, *, lock: bool = False) -> object:
        if owner_type == WalletOwner.VENDOR:
            from services.vendor.models import Vendor as Model
        else:
            from services.dispatch.models import Rider as Model  # type: ignore[assignment]
        query = select(Model).where(Model.user_id == uuid.UUID(user_id))
        if lock:
            query = query.with_for_update()  # serialises concurrent withdrawals for one owner
        owner = (await self.db.execute(query)).scalar_one_or_none()
        if not owner:
            raise NotFoundException(f"{owner_type.capitalize()} profile not found")
        return owner

    async def _get_owner_by_id(self, owner_type: str, owner_id: uuid.UUID, *, lock: bool = False) -> object:
        if owner_type == WalletOwner.VENDOR:
            from services.vendor.models import Vendor as Model
        else:
            from services.dispatch.models import Rider as Model  # type: ignore[assignment]
        query = select(Model).where(Model.id == owner_id)
        if lock:
            query = query.with_for_update()
        owner = (await self.db.execute(query)).scalar_one_or_none()
        if not owner:
            raise NotFoundException(f"{owner_type.capitalize()} not found")
        return owner

    # ── Crediting (called from the order lifecycle — never by clients) ───────

    async def _credit(
        self,
        owner_type: str,
        owner_id: uuid.UUID,
        order_id: uuid.UUID,
        amount_kobo: int,
        metadata: dict,
    ) -> bool:
        """Idempotent: a second credit for the same order and owner is a no-op. Returns whether
        a new entry was written."""
        if amount_kobo <= 0:
            return False
        exists = (await self.db.execute(
            select(WalletEntry.id).where(
                WalletEntry.owner_type == owner_type,
                WalletEntry.owner_id == owner_id,
                WalletEntry.order_id == order_id,
                WalletEntry.kind == WalletEntryKind.ORDER_CREDIT,
            )
        )).first()
        if exists:
            return False
        self.db.add(WalletEntry(
            owner_type=owner_type,
            owner_id=owner_id,
            kind=WalletEntryKind.ORDER_CREDIT,
            amount_kobo=amount_kobo,
            order_id=order_id,
            entry_metadata=metadata,
        ))
        await self.db.flush()
        return True

    async def credit_vendor_for_order(
        self, order: Order, *, amount_kobo: int | None = None, reason: str = "order_released"
    ) -> int:
        """Credit the vendor's Available balance with the product total minus platform commission
        (the delivery fee is the rider's, never the vendor's). `amount_kobo` overrides the amount
        for an admin-decided dispute split, where no commission is taken. Returns the amount."""
        from services.analytics.service import AnalyticsService

        if amount_kobo is None:
            config = await AnalyticsService(self.db).get_config()
            commission = int(order.total_kobo * config["commission_rate_percent"] / 100)
            net = order.total_kobo - commission
            meta = {"reason": reason, "gross_kobo": order.total_kobo, "commission_kobo": commission,
                    "commission_rate_percent": config["commission_rate_percent"]}
        else:
            net = amount_kobo
            meta = {"reason": reason, "gross_kobo": order.total_kobo, "commission_kobo": 0}
        await self._credit(WalletOwner.VENDOR, order.vendor_id, order.id, net, meta)
        return net

    async def credit_rider_for_order(self, order: Order) -> int:
        """Credit the rider's Available balance with the order's delivery fee, in full. Called when
        the order is delivered."""
        if not order.rider_id or order.delivery_fee_kobo <= 0:
            return 0
        await self._credit(
            WalletOwner.RIDER, order.rider_id, order.id, order.delivery_fee_kobo,
            {"reason": "delivered", "delivery_quote": order.delivery_quote},
        )
        return order.delivery_fee_kobo

    # ── Balances ──────────────────────────────────────────────────────────────

    async def _sum_orders(self, owner_type: str, owner_id: uuid.UUID, states: list[str]) -> list[Order]:
        column = Order.vendor_id if owner_type == WalletOwner.VENDOR else Order.rider_id
        result = await self.db.execute(
            select(Order).where(column == owner_id, Order.status.in_(states))
        )
        return list(result.scalars().all())

    async def get_summary(self, owner_type: str, owner_id: uuid.UUID, *, has_account: bool) -> dict:
        from services.analytics.service import AnalyticsService

        config = await AnalyticsService(self.db).get_config()
        rate = config["commission_rate_percent"]

        def vendor_net(o: Order) -> int:
            return o.total_kobo - int(o.total_kobo * rate / 100)

        def amount(o: Order) -> int:
            return vendor_net(o) if owner_type == WalletOwner.VENDOR else o.delivery_fee_kobo

        ongoing = sum(amount(o) for o in await self._sum_orders(owner_type, owner_id, _ONGOING_STATES))
        if owner_type == WalletOwner.VENDOR:
            clearing = sum(amount(o) for o in await self._sum_orders(owner_type, owner_id, _VENDOR_CLEARING_STATES))
            on_hold = sum(amount(o) for o in await self._sum_orders(owner_type, owner_id, [OrderStatus.DISPUTED]))
        else:
            clearing = on_hold = 0  # rider pay is credited on delivery

        available = int((await self.db.execute(
            select(func.coalesce(func.sum(WalletEntry.amount_kobo), 0)).where(
                WalletEntry.owner_type == owner_type, WalletEntry.owner_id == owner_id
            )
        )).scalar_one())
        lifetime = int((await self.db.execute(
            select(func.coalesce(func.sum(WalletEntry.amount_kobo), 0)).where(
                WalletEntry.owner_type == owner_type,
                WalletEntry.owner_id == owner_id,
                WalletEntry.kind == WalletEntryKind.ORDER_CREDIT,
            )
        )).scalar_one())

        requests = (await self.db.execute(
            select(PayoutRequest).where(
                PayoutRequest.owner_type == owner_type,
                PayoutRequest.owner_id == owner_id,
                PayoutRequest.status.in_([PayoutStatus.REQUESTED, PayoutStatus.PROCESSING, PayoutStatus.PAID]),
            )
        )).scalars().all()
        requested = sum(
            r.requested_kobo if r.status == PayoutStatus.REQUESTED else (r.approved_kobo or 0)
            for r in requests if r.status in (PayoutStatus.REQUESTED, PayoutStatus.PROCESSING)
        )
        paid = sum((r.approved_kobo or 0) for r in requests if r.status == PayoutStatus.PAID)

        return {
            "ongoing_kobo": ongoing,
            "clearing_kobo": clearing,
            "on_hold_kobo": on_hold,
            "available_kobo": available,
            "requested_kobo": requested,
            "paid_out_kobo": paid,
            "lifetime_earned_kobo": lifetime,
            "min_withdrawal_kobo": int(config["min_withdrawal_kobo"]),
            "has_payout_account": has_account,
        }

    async def my_summary(self, owner_type: str, user_id: str) -> dict:
        owner = await self._get_owner(owner_type, user_id)
        return await self.get_summary(
            owner_type, owner.id, has_account=bool(owner.paystack_recipient_code)  # type: ignore[attr-defined]
        )

    async def list_entries(
        self, owner_type: str, user_id: str, page: int, page_size: int
    ) -> tuple[list[WalletEntry], int]:
        owner = await self._get_owner(owner_type, user_id)
        where = (WalletEntry.owner_type == owner_type, WalletEntry.owner_id == owner.id)  # type: ignore[attr-defined]
        total = (await self.db.execute(select(func.count()).select_from(WalletEntry).where(*where))).scalar_one()
        rows = (await self.db.execute(
            select(WalletEntry).where(*where)
            .order_by(WalletEntry.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size)
        )).scalars().all()
        return list(rows), total

    # ── Withdrawal requests (vendor / rider side) ─────────────────────────────

    def _destination(self, owner: object) -> dict:
        number = owner.payout_account_number or ""  # type: ignore[attr-defined]
        return {
            "bank_name": owner.payout_bank_name,  # type: ignore[attr-defined]
            "account_name": owner.payout_account_name,  # type: ignore[attr-defined]
            "account_number_masked": f"••••{number[-4:]}" if number else None,
        }

    def _event(
        self, request_id: uuid.UUID, event: str, actor_id: uuid.UUID | None, actor_role: str,
        amount_kobo: int | None = None, note: str | None = None,
    ) -> None:
        self.db.add(PayoutRequestEvent(
            payout_request_id=request_id, event=event, actor_id=actor_id,
            actor_role=actor_role, amount_kobo=amount_kobo, note=note,
        ))

    async def request_withdrawal(self, owner_type: str, user_id: str, amount_kobo: int) -> PayoutRequest:
        owner = await self._get_owner(owner_type, user_id, lock=True)
        if not owner.paystack_recipient_code:  # type: ignore[attr-defined]
            raise AppError(422, "PAYOUT_ACCOUNT_NOT_SET", "Add a payout bank account before requesting a withdrawal")

        summary = await self.get_summary(owner_type, owner.id, has_account=True)  # type: ignore[attr-defined]
        if amount_kobo < summary["min_withdrawal_kobo"]:
            raise AppError(
                422, "BELOW_MINIMUM_WITHDRAWAL",
                f"Minimum withdrawal is ₦{summary['min_withdrawal_kobo'] / 100:,.2f}",
            )
        if amount_kobo > summary["available_kobo"]:
            raise AppError(422, "INSUFFICIENT_AVAILABLE_BALANCE", "Amount exceeds your available balance")

        request = PayoutRequest(
            owner_type=owner_type,
            owner_id=owner.id,  # type: ignore[attr-defined]
            requested_by=uuid.UUID(user_id),
            requested_kobo=amount_kobo,
            status=PayoutStatus.REQUESTED,
            destination=self._destination(owner),
        )
        self.db.add(request)
        await self.db.flush()
        self.db.add(WalletEntry(
            owner_type=owner_type, owner_id=owner.id, kind=WalletEntryKind.WITHDRAWAL_HOLD,  # type: ignore[attr-defined]
            amount_kobo=-amount_kobo, payout_request_id=request.id,
        ))
        self._event(request.id, PayoutEventType.REQUESTED, uuid.UUID(user_id), owner_type, amount_kobo)
        await self.db.flush()
        return request

    async def list_my_requests(
        self, owner_type: str, user_id: str, page: int, page_size: int
    ) -> tuple[list[PayoutRequest], int]:
        owner = await self._get_owner(owner_type, user_id)
        where = (PayoutRequest.owner_type == owner_type, PayoutRequest.owner_id == owner.id)  # type: ignore[attr-defined]
        total = (await self.db.execute(select(func.count()).select_from(PayoutRequest).where(*where))).scalar_one()
        rows = (await self.db.execute(
            select(PayoutRequest).where(*where)
            .order_by(PayoutRequest.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size)
        )).scalars().all()
        return list(rows), total

    # ── Admin side ────────────────────────────────────────────────────────────

    async def admin_list_requests(
        self, status: str | None, owner_type: str | None, page: int, page_size: int
    ) -> tuple[list[PayoutRequest], int, int, int]:
        where = []
        if status:
            where.append(PayoutRequest.status == status)
        if owner_type:
            where.append(PayoutRequest.owner_type == owner_type)
        total = (await self.db.execute(select(func.count()).select_from(PayoutRequest).where(*where))).scalar_one()
        rows = (await self.db.execute(
            select(PayoutRequest).where(*where)
            .order_by(PayoutRequest.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size)
        )).scalars().all()
        pending = (await self.db.execute(
            select(func.count(), func.coalesce(func.sum(PayoutRequest.requested_kobo), 0))
            .where(PayoutRequest.status == PayoutStatus.REQUESTED)
        )).one()
        return list(rows), total, int(pending[0]), int(pending[1])

    async def owner_names(self, requests: list[PayoutRequest]) -> dict[uuid.UUID, str]:
        from services.auth.models import User
        from services.dispatch.models import Rider
        from services.vendor.models import Vendor

        names: dict[uuid.UUID, str] = {}
        vendor_ids = [r.owner_id for r in requests if r.owner_type == WalletOwner.VENDOR]
        rider_ids = [r.owner_id for r in requests if r.owner_type == WalletOwner.RIDER]
        if vendor_ids:
            for vid, name in (await self.db.execute(select(Vendor.id, Vendor.name).where(Vendor.id.in_(vendor_ids)))).all():
                names[vid] = name
        if rider_ids:
            for rid, name in (await self.db.execute(
                select(Rider.id, User.name).join(User, User.id == Rider.user_id).where(Rider.id.in_(rider_ids))
            )).all():
                names[rid] = name
        return names

    async def admin_get_request(self, request_id: str) -> tuple[PayoutRequest, list[PayoutRequestEvent], dict]:
        request = await self._get_request(request_id)
        events = list((await self.db.execute(
            select(PayoutRequestEvent)
            .where(PayoutRequestEvent.payout_request_id == request.id)
            .order_by(PayoutRequestEvent.created_at)
        )).scalars().all())
        owner = await self._get_owner_by_id(request.owner_type, request.owner_id)
        summary = await self.get_summary(
            request.owner_type, request.owner_id,
            has_account=bool(owner.paystack_recipient_code),  # type: ignore[attr-defined]
        )
        return request, events, summary

    async def _get_request(self, request_id: str, *, lock: bool = False) -> PayoutRequest:
        query = select(PayoutRequest).where(PayoutRequest.id == uuid.UUID(request_id))
        if lock:
            query = query.with_for_update()
        request = (await self.db.execute(query)).scalar_one_or_none()
        if not request:
            raise NotFoundException("Payout request not found")
        return request

    def _audit(self, admin_id: str, action: str, request: PayoutRequest, before: dict, after: dict) -> None:
        from services.analytics.models import AuditLog

        self.db.add(AuditLog(
            actor_id=uuid.UUID(admin_id), action=action, target_type="payout_request",
            target_id=str(request.id), before=before, after=after,
        ))

    async def approve(self, request_id: str, admin_id: str, approved_kobo: int, note: str | None) -> PayoutRequest:
        """Approve an amount (≤ what was requested) and send it. The only code path that moves
        wallet money to a bank. If the transfer call itself fails nothing is committed, so the
        request stays REQUESTED and can be retried."""
        from services.payment.providers.registry import get_provider

        request = await self._get_request(request_id, lock=True)
        if request.status != PayoutStatus.REQUESTED:
            raise AppError(409, "PAYOUT_NOT_PENDING", f"This request is already {request.status.lower()}")
        if approved_kobo > request.requested_kobo:
            raise AppError(422, "APPROVED_EXCEEDS_REQUESTED", "Approved amount cannot exceed the requested amount")

        owner = await self._get_owner_by_id(request.owner_type, request.owner_id, lock=True)
        if not owner.paystack_recipient_code:  # type: ignore[attr-defined]
            raise AppError(422, "PAYOUT_ACCOUNT_NOT_SET", "Owner no longer has a payout bank account saved")

        before = {"status": request.status, "requested_kobo": request.requested_kobo}
        request.approved_kobo = approved_kobo
        request.decided_by = uuid.UUID(admin_id)
        request.decided_at = datetime.now(UTC)
        request.decision_note = note
        request.destination = self._destination(owner)  # what was actually paid, not what it was at request time
        request.transfer_ref = f"wd-{request.id}"

        remainder = request.requested_kobo - approved_kobo
        if remainder > 0:
            self.db.add(WalletEntry(
                owner_type=request.owner_type, owner_id=request.owner_id,
                kind=WalletEntryKind.WITHDRAWAL_RELEASE, amount_kobo=remainder,
                payout_request_id=request.id, entry_metadata={"reason": "approved_less_than_requested"},
            ))
        self._event(request.id, PayoutEventType.APPROVED, uuid.UUID(admin_id), "admin", approved_kobo, note)

        provider = get_provider("paystack")
        result = await provider.transfer_to_vendor(
            owner.paystack_recipient_code, approved_kobo, request.transfer_ref  # type: ignore[attr-defined]
        )
        if result.status == "otp":
            raise AppError(
                502, "TRANSFER_REQUIRES_OTP",
                "Paystack requested OTP confirmation — disable Transfer OTP in Paystack Settings > Preferences.",
            )
        if result.status == "success":
            request.status = PayoutStatus.PAID
            request.paid_at = datetime.now(UTC)
            self._event(request.id, PayoutEventType.TRANSFER_SUCCESS, None, "system", approved_kobo)
        elif result.status == "pending":
            request.status = PayoutStatus.PROCESSING
        else:
            raise AppError(502, "TRANSFER_FAILED", f"Transfer returned unexpected status '{result.status}'")

        self._audit(admin_id, "payout.approve", request, before,
                    {"status": request.status, "approved_kobo": approved_kobo, "note": note})
        await self.db.flush()
        return request

    async def reject(self, request_id: str, admin_id: str, note: str) -> PayoutRequest:
        request = await self._get_request(request_id, lock=True)
        if request.status != PayoutStatus.REQUESTED:
            raise AppError(409, "PAYOUT_NOT_PENDING", f"This request is already {request.status.lower()}")
        before = {"status": request.status, "requested_kobo": request.requested_kobo}
        request.status = PayoutStatus.REJECTED
        request.decided_by = uuid.UUID(admin_id)
        request.decided_at = datetime.now(UTC)
        request.decision_note = note
        self.db.add(WalletEntry(
            owner_type=request.owner_type, owner_id=request.owner_id,
            kind=WalletEntryKind.WITHDRAWAL_RELEASE, amount_kobo=request.requested_kobo,
            payout_request_id=request.id, entry_metadata={"reason": "rejected"},
        ))
        self._event(request.id, PayoutEventType.REJECTED, uuid.UUID(admin_id), "admin", request.requested_kobo, note)
        self._audit(admin_id, "payout.reject", request, before, {"status": request.status, "note": note})
        await self.db.flush()
        return request

    async def handle_transfer_webhook(self, event_type: str, reference: str) -> None:
        """Applies Paystack's eventual verdict on an approved withdrawal. `reference` is the
        `wd-{request_id}` string sent when the transfer was created."""
        if not reference.startswith("wd-"):
            return
        request = (await self.db.execute(
            select(PayoutRequest).where(PayoutRequest.transfer_ref == reference).with_for_update()
        )).scalar_one_or_none()
        if not request or request.status != PayoutStatus.PROCESSING:
            return  # unknown, or already settled — webhooks are delivered at-least-once

        if event_type == "transfer.success":
            request.status = PayoutStatus.PAID
            request.paid_at = datetime.now(UTC)
            self._event(request.id, PayoutEventType.TRANSFER_SUCCESS, None, "system", request.approved_kobo)
        else:  # transfer.failed, transfer.reversed — the money never reached the bank
            request.status = PayoutStatus.FAILED
            request.failure_reason = event_type
            self.db.add(WalletEntry(
                owner_type=request.owner_type, owner_id=request.owner_id,
                kind=WalletEntryKind.WITHDRAWAL_REVERSAL, amount_kobo=request.approved_kobo or 0,
                payout_request_id=request.id, entry_metadata={"reason": event_type},
            ))
            self._event(request.id, PayoutEventType.TRANSFER_FAILED, None, "system", request.approved_kobo, event_type)
        await self.db.flush()
