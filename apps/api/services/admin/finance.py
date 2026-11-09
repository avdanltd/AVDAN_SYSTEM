"""Financial Tracker: who earned and who spent what, over a period, for the finance team.

One money model for every order, so the columns always reconcile:

    customer_paid = total_kobo + delivery_fee_kobo
    vendor        = what the vendor is credited   (wallet ORDER_CREDIT, else the order snapshot)
    rider         = what the rider is credited    (wallet ORDER_CREDIT, else the order snapshot)
    AVDAN         = customer_paid - vendor - rider   (product markup + AVDAN's delivery cut)

"Earned" means the payment was **released** (order reached PAYMENT_RELEASED), dated by that event.
"Paid but not yet released" is money the customer has paid that is still held in escrow, dated by
the PAID event. Customers' "spent" is everything they paid on orders that were not cancelled,
rejected or refunded.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import NotFoundException, ValidationException
from services.analytics.service import AnalyticsService
from services.auth.models import User
from services.dispatch.models import Rider
from services.orders.models import Order, OrderEvent
from services.orders.state_machine import OrderStatus
from services.vendor.models import Vendor
from services.wallet.models import PayoutRequest, PayoutStatus, WalletEntry, WalletEntryKind, WalletOwner

RELEASED = {OrderStatus.PAYMENT_RELEASED, OrderStatus.COMPLETED}
# Paid orders whose money went (or is going) back to the customer, or never reached anyone.
NOT_SPENT = {
    OrderStatus.PENDING,
    OrderStatus.CANCELLED,
    OrderStatus.VENDOR_REJECTED,
    OrderStatus.REFUND_INITIATED,
    OrderStatus.FAILED_DELIVERY,
}
KINDS = ("vendor", "rider", "customer")
MAX_ORDER_LINES = 500


@dataclass
class Line:
    """One order, with its money split and the two dates that place it in a period."""

    order: Order
    paid_at: datetime | None
    released_at: datetime | None
    customer_paid: int
    vendor: int
    rider: int

    @property
    def avdan(self) -> int:
        return self.customer_paid - self.vendor - self.rider

    @property
    def is_released(self) -> bool:
        return self.order.status in RELEASED and self.released_at is not None

    @property
    def is_pending_release(self) -> bool:
        return self.order.status not in RELEASED and self.order.status not in NOT_SPENT


def _sum(lines: list[Line], attr: str) -> int:
    return sum(getattr(line, attr) for line in lines)


def _totals(lines: list[Line]) -> dict:
    avdan_delivery = sum(
        line.order.delivery_fee_kobo
        - (line.order.delivery_fee_kobo if line.order.rider_fee_kobo is None else line.order.rider_fee_kobo)
        for line in lines
    )
    avdan = _sum(lines, "avdan")
    return {
        "orders": len(lines),
        "customer_paid_kobo": _sum(lines, "customer_paid"),
        "vendors_kobo": _sum(lines, "vendor"),
        "riders_kobo": _sum(lines, "rider"),
        "avdan_product_kobo": avdan - avdan_delivery,
        "avdan_delivery_kobo": avdan_delivery,
        "avdan_total_kobo": avdan,
    }


class FinanceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Building blocks ───────────────────────────────────────────────────────

    @staticmethod
    def _check_range(start: datetime, end: datetime) -> None:
        if end <= start:
            raise ValidationException("The end of the period must be after its start.")
        if (end - start).days > 366 * 3:
            raise ValidationException("Pick a period of three years or less.")

    def _event_at(self, state: str):  # type: ignore[no-untyped-def]
        return (
            select(func.min(OrderEvent.created_at))
            .where(OrderEvent.order_id == Order.id, OrderEvent.to_state == state)
            .correlate(Order)
            .scalar_subquery()
        )

    async def _lines(self, condition) -> list[Line]:  # type: ignore[no-untyped-def]
        """Orders whose event dates satisfy `condition(paid_at, released_at)`, with their money split."""
        paid_at = self._event_at(OrderStatus.PAID)
        released_at = self._event_at(OrderStatus.PAYMENT_RELEASED)
        q = select(Order, paid_at.label("paid_at"), released_at.label("released_at")).where(
            condition(paid_at, released_at)
        )
        rows = (await self.db.execute(q)).all()
        if not rows:
            return []

        order_ids = [o.id for o, _, _ in rows]
        credits = {
            (e.owner_type, e.order_id): e.amount_kobo
            for e in (await self.db.execute(
                select(WalletEntry).where(
                    WalletEntry.kind == WalletEntryKind.ORDER_CREDIT, WalletEntry.order_id.in_(order_ids)
                )
            )).scalars()
        }
        rate = float((await AnalyticsService(self.db).get_config())["commission_rate_percent"])

        lines: list[Line] = []
        for o, paid, released in rows:
            vendor = credits.get((WalletOwner.VENDOR, o.id))
            if vendor is None:
                vendor = (
                    o.vendor_total_kobo
                    if o.vendor_total_kobo is not None
                    else o.total_kobo - int(o.total_kobo * rate / 100)
                )
            rider = credits.get((WalletOwner.RIDER, o.id))
            if rider is None:
                rider = o.delivery_fee_kobo if o.rider_fee_kobo is None else o.rider_fee_kobo
            lines.append(Line(o, paid, released, o.total_kobo + o.delivery_fee_kobo, vendor, rider))
        return lines

    async def _released(self, start: datetime, end: datetime) -> list[Line]:
        return [
            line
            for line in await self._lines(lambda _p, r: and_(r >= start, r < end))
            if line.is_released
        ]

    async def _pending(self, start: datetime, end: datetime) -> list[Line]:
        return [
            line
            for line in await self._lines(lambda p, _r: and_(p >= start, p < end))
            if line.is_pending_release
        ]

    async def _spent(self, start: datetime, end: datetime) -> list[Line]:
        return [
            line
            for line in await self._lines(lambda p, _r: and_(p >= start, p < end))
            if line.order.status not in NOT_SPENT
        ]

    async def _payouts_paid(self, start: datetime, end: datetime) -> list[PayoutRequest]:
        return list((await self.db.execute(
            select(PayoutRequest).where(
                PayoutRequest.status == PayoutStatus.PAID,
                PayoutRequest.paid_at >= start,
                PayoutRequest.paid_at < end,
            )
        )).scalars())

    # ── Summary ───────────────────────────────────────────────────────────────

    async def summary(self, start: datetime, end: datetime) -> dict:
        self._check_range(start, end)
        released = await self._released(start, end)
        pending = await self._pending(start, end)
        payouts = await self._payouts_paid(start, end)
        in_flight = (await self.db.execute(
            select(func.coalesce(func.sum(PayoutRequest.requested_kobo), 0)).where(
                PayoutRequest.status.in_([PayoutStatus.REQUESTED, PayoutStatus.PROCESSING])
            )
        )).scalar_one()
        return {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "released": _totals(released),
            "pending": _totals(pending),
            "payouts": {
                "paid_out_kobo": sum((p.approved_kobo or 0) for p in payouts),
                "vendors_paid_out_kobo": sum(
                    (p.approved_kobo or 0) for p in payouts if p.owner_type == WalletOwner.VENDOR
                ),
                "riders_paid_out_kobo": sum(
                    (p.approved_kobo or 0) for p in payouts if p.owner_type == WalletOwner.RIDER
                ),
                "awaiting_payout_kobo": int(in_flight),
            },
        }

    async def pending_orders(self, start: datetime, end: datetime) -> dict:
        """The 'paid but not yet released' list: money that is coming in."""
        self._check_range(start, end)
        lines = sorted(await self._pending(start, end), key=lambda ln: ln.paid_at or start, reverse=True)
        names = await self._customer_names({ln.order.customer_id for ln in lines})
        vendors = await self._vendor_names({ln.order.vendor_id for ln in lines})
        return {
            "totals": _totals(lines),
            "orders": [
                {
                    "order_id": str(ln.order.id),
                    "status": ln.order.status,
                    "paid_at": ln.paid_at.isoformat() if ln.paid_at else None,
                    "customer_name": names.get(ln.order.customer_id),
                    "vendor_name": vendors.get(ln.order.vendor_id),
                    "customer_paid_kobo": ln.customer_paid,
                    "vendor_kobo": ln.vendor,
                    "rider_kobo": ln.rider,
                    "avdan_kobo": ln.avdan,
                }
                for ln in lines[:MAX_ORDER_LINES]
            ],
        }

    # ── Names ─────────────────────────────────────────────────────────────────

    async def _customer_names(self, ids: set[uuid.UUID]) -> dict:
        if not ids:
            return {}
        rows = await self.db.execute(select(User.id, User.name).where(User.id.in_(ids)))
        return dict(rows.all())

    async def _vendor_names(self, ids: set[uuid.UUID]) -> dict:
        if not ids:
            return {}
        rows = await self.db.execute(select(Vendor.id, Vendor.name).where(Vendor.id.in_(ids)))
        return dict(rows.all())

    # ── Per person ────────────────────────────────────────────────────────────

    async def people(self, kind: str, start: datetime, end: datetime, search: str | None = None) -> list[dict]:
        if kind not in KINDS:
            raise ValidationException("kind must be vendor, rider or customer")
        self._check_range(start, end)

        if kind == "customer":
            return await self._customers(start, end, search)

        owner_attr = "vendor_id" if kind == "vendor" else "rider_id"
        owner_type = WalletOwner.VENDOR if kind == "vendor" else WalletOwner.RIDER
        released = await self._released(start, end)
        pending = await self._pending(start, end)

        def money(line: Line) -> int:
            return line.vendor if kind == "vendor" else line.rider

        earned: dict[uuid.UUID, list[Line]] = {}
        for line in released:
            owner = getattr(line.order, owner_attr)
            if owner:
                earned.setdefault(owner, []).append(line)
        coming: dict[uuid.UUID, list[Line]] = {}
        for line in pending:
            owner = getattr(line.order, owner_attr)
            if owner:
                coming.setdefault(owner, []).append(line)

        paid_out: dict[uuid.UUID, int] = {}
        for p in await self._payouts_paid(start, end):
            if p.owner_type == owner_type:
                paid_out[p.owner_id] = paid_out.get(p.owner_id, 0) + (p.approved_kobo or 0)

        # What they are owed now (all-time): wallet balance plus withdrawals still in flight.
        balances: dict[uuid.UUID, int] = {
            oid: int(total)
            for oid, total in (await self.db.execute(
                select(WalletEntry.owner_id, func.sum(WalletEntry.amount_kobo))
                .where(WalletEntry.owner_type == owner_type)
                .group_by(WalletEntry.owner_id)
            )).all()
        }
        for oid, total in (await self.db.execute(
            select(PayoutRequest.owner_id, func.sum(PayoutRequest.requested_kobo))
            .where(
                PayoutRequest.owner_type == owner_type,
                PayoutRequest.status.in_([PayoutStatus.REQUESTED, PayoutStatus.PROCESSING]),
            )
            .group_by(PayoutRequest.owner_id)
        )).all():
            balances[oid] = balances.get(oid, 0) + int(total)

        ids = set(earned) | set(coming) | set(paid_out) | {i for i, b in balances.items() if b > 0}
        info = await self._owner_info(kind, ids)
        rows = []
        for oid in ids:
            name, email, user_id = info.get(oid, ("(unknown)", None, None))
            if user_id is None:
                continue
            rows.append({
                "user_id": str(user_id),
                "name": name,
                "email": email,
                "orders": len(earned.get(oid, [])),
                "earned_kobo": sum(money(ln) for ln in earned.get(oid, [])),
                "pending_kobo": sum(money(ln) for ln in coming.get(oid, [])),
                "paid_out_kobo": paid_out.get(oid, 0),
                "balance_kobo": balances.get(oid, 0),
            })
        return self._filter_sort(rows, search, "earned_kobo")

    async def _owner_info(self, kind: str, ids: set[uuid.UUID]) -> dict:
        """{vendor_id|rider_id: (name, email, user_id)}."""
        if not ids:
            return {}
        if kind == "vendor":
            q = select(Vendor.id, Vendor.name, User.email, User.id).join(User, User.id == Vendor.user_id).where(
                Vendor.id.in_(ids)
            )
        else:
            q = select(Rider.id, User.name, User.email, User.id).join(User, User.id == Rider.user_id).where(
                Rider.id.in_(ids)
            )
        return {i: (n, e, u) for i, n, e, u in (await self.db.execute(q)).all()}

    async def _customers(self, start: datetime, end: datetime, search: str | None) -> list[dict]:
        lines = await self._spent(start, end)
        by_customer: dict[uuid.UUID, list[Line]] = {}
        for line in lines:
            by_customer.setdefault(line.order.customer_id, []).append(line)
        users = {}
        if by_customer:
            rows = await self.db.execute(select(User.id, User.name, User.email).where(User.id.in_(by_customer)))
            users = {i: (n, e) for i, n, e in rows.all()}
        rows_out = []
        for uid, ls in by_customer.items():
            name, email = users.get(uid, ("(unknown)", None))
            rows_out.append({
                "user_id": str(uid),
                "name": name,
                "email": email,
                "orders": len(ls),
                "spent_kobo": _sum(ls, "customer_paid"),
                # Of which still held in escrow rather than released.
                "pending_kobo": sum(ln.customer_paid for ln in ls if not ln.is_released),
            })
        return self._filter_sort(rows_out, search, "spent_kobo")

    @staticmethod
    def _filter_sort(rows: list[dict], search: str | None, key: str) -> list[dict]:
        if search and search.strip():
            needle = search.strip().lower()
            rows = [r for r in rows if needle in (r["name"] or "").lower() or needle in (r["email"] or "").lower()]
        return sorted(rows, key=lambda r: (-r[key], (r["name"] or "").lower()))

    async def person(self, kind: str, user_id: str, start: datetime, end: datetime) -> dict:
        """One vendor, rider or customer: their totals and the orders behind them."""
        if kind not in KINDS:
            raise ValidationException("kind must be vendor, rider or customer")
        self._check_range(start, end)
        uid = uuid.UUID(user_id)
        user = (await self.db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
        if not user:
            raise NotFoundException("User not found")

        owner_id: uuid.UUID | None = None
        if kind == "vendor":
            owner_id = (await self.db.execute(select(Vendor.id).where(Vendor.user_id == uid))).scalar_one_or_none()
        elif kind == "rider":
            owner_id = (await self.db.execute(select(Rider.id).where(Rider.user_id == uid))).scalar_one_or_none()
        if kind != "customer" and owner_id is None:
            raise NotFoundException(f"This user has no {kind} profile")

        def mine(line: Line) -> bool:
            if kind == "customer":
                return line.order.customer_id == uid
            return getattr(line.order, "vendor_id" if kind == "vendor" else "rider_id") == owner_id

        def money(line: Line) -> int:
            return line.customer_paid if kind == "customer" else (line.vendor if kind == "vendor" else line.rider)

        if kind == "customer":
            counted = [ln for ln in await self._spent(start, end) if mine(ln)]
            done = [ln for ln in counted if ln.is_released]
            waiting = [ln for ln in counted if not ln.is_released]
        else:
            done = [ln for ln in await self._released(start, end) if mine(ln)]
            waiting = [ln for ln in await self._pending(start, end) if mine(ln)]

        payouts: list[PayoutRequest] = []
        balance = 0
        if kind != "customer":
            owner_type = WalletOwner.VENDOR if kind == "vendor" else WalletOwner.RIDER
            payouts = [p for p in await self._payouts_paid(start, end) if p.owner_type == owner_type and p.owner_id == owner_id]
            balance = int((await self.db.execute(
                select(func.coalesce(func.sum(WalletEntry.amount_kobo), 0)).where(
                    WalletEntry.owner_type == owner_type, WalletEntry.owner_id == owner_id
                )
            )).scalar_one()) + int((await self.db.execute(
                select(func.coalesce(func.sum(PayoutRequest.requested_kobo), 0)).where(
                    PayoutRequest.owner_type == owner_type,
                    PayoutRequest.owner_id == owner_id,
                    PayoutRequest.status.in_([PayoutStatus.REQUESTED, PayoutStatus.PROCESSING]),
                )
            )).scalar_one())

        def order_row(ln: Line, state: str) -> dict:
            when = ln.released_at if state == "released" else ln.paid_at
            return {
                "order_id": str(ln.order.id),
                "status": ln.order.status,
                "state": state,
                "date": when.isoformat() if when else None,
                "amount_kobo": money(ln),
                "customer_paid_kobo": ln.customer_paid,
            }

        rows = sorted(
            [order_row(ln, "released") for ln in done] + [order_row(ln, "pending") for ln in waiting],
            key=lambda r: r["date"] or "",
            reverse=True,
        )
        return {
            "kind": kind,
            "user_id": user_id,
            "name": user.name,
            "email": user.email,
            "start": start.isoformat(),
            "end": end.isoformat(),
            # earned (vendor/rider) or spent (customer) on released orders; the rest is still in escrow.
            "released_kobo": sum(money(ln) for ln in done),
            "pending_kobo": sum(money(ln) for ln in waiting),
            "orders": len(done) + len(waiting),
            "paid_out_kobo": sum((p.approved_kobo or 0) for p in payouts),
            "balance_kobo": balance,
            "order_lines": rows[:MAX_ORDER_LINES],
            "truncated": len(rows) > MAX_ORDER_LINES,
        }
