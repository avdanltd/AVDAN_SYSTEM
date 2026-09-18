"""Analytics and platform config service."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from services.analytics.models import DEFAULT_PLATFORM_CONFIG, AuditLog, PlatformConfig
from services.dispatch.models import Rider
from services.dispute.models import Dispute
from services.orders.models import Order
from services.orders.state_machine import OrderStatus
from services.payment.models import EscrowStatus, EscrowTransaction

_TERMINAL_STATES = {
    OrderStatus.COMPLETED,
    OrderStatus.REFUND_INITIATED,
    OrderStatus.FAILED_DELIVERY,
    OrderStatus.CANCELLED,
    OrderStatus.VENDOR_REJECTED,
}


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Admin analytics ───────────────────────────────────────────────────────

    async def get_overview(self) -> dict:
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

        active_orders = (await self.db.execute(
            select(func.count()).select_from(Order).where(
                Order.status.not_in(list(_TERMINAL_STATES))
            )
        )).scalar_one()

        riders_online = (await self.db.execute(
            select(func.count()).select_from(Rider).where(Rider.online.is_(True))
        )).scalar_one()

        config = await self.get_config()
        commission_rate = config["commission_rate_percent"] / 100

        # `EscrowTransaction.amount_kobo` is the full customer charge (order.total_kobo +
        # delivery_fee_kobo) — most of that is NOT platform revenue: the vendor's payout (order
        # total minus commission) and the rider's delivery fee are both paid out separately. The
        # platform's actual revenue is only its commission cut. Summing amount_kobo directly (the
        # old code here) overstated "revenue" by the vendor payout + rider fee on every released
        # order. Fixed the same way as `get_vendor_analytics`: sum `Order.total_kobo` for released
        # orders, then apply commission once.
        revenue_gross_today = int((await self.db.execute(
            select(func.coalesce(func.sum(Order.total_kobo), 0))
            .select_from(Order)
            .join(EscrowTransaction, EscrowTransaction.order_id == Order.id)
            .where(
                EscrowTransaction.status == EscrowStatus.RELEASED,
                EscrowTransaction.created_at >= today_start,
            )
        )).scalar_one())
        revenue_today = int(revenue_gross_today * commission_rate)

        gmv_today = int((await self.db.execute(
            select(func.coalesce(func.sum(Order.total_kobo), 0)).where(
                Order.created_at >= today_start
            )
        )).scalar_one())

        orders_today = (await self.db.execute(
            select(func.count()).select_from(Order).where(Order.created_at >= today_start)
        )).scalar_one()

        pending_disputes = (await self.db.execute(
            select(func.count()).select_from(Dispute).where(
                Dispute.status.in_(["open", "under_review"])
            )
        )).scalar_one()

        return {
            "active_orders": active_orders,
            "riders_online": riders_online,
            "revenue_today_kobo": revenue_today,
            "gmv_today_kobo": gmv_today,
            "orders_today": orders_today,
            "pending_disputes": pending_disputes,
        }

    async def get_order_volume(self, period: str = "day") -> dict:
        trunc = period if period in ("day", "week", "month") else "day"
        if trunc == "week":
            since = datetime.now(UTC) - timedelta(weeks=12)
        elif trunc == "month":
            since = datetime.now(UTC) - timedelta(days=365)
        else:
            since = datetime.now(UTC) - timedelta(days=30)

        period_expr = func.date_trunc(trunc, Order.created_at)
        result = await self.db.execute(
            select(
                period_expr.label("period"),
                func.count().label("order_count"),
                func.coalesce(func.sum(Order.total_kobo), 0).label("volume_kobo"),
            )
            .where(Order.created_at >= since)
            .group_by(period_expr)
            .order_by(period_expr)
        )
        return {
            "period_type": trunc,
            "data": [
                {
                    "period": row.period.isoformat(),
                    "order_count": row.order_count,
                    "volume_kobo": int(row.volume_kobo),
                }
                for row in result.all()
            ],
        }

    async def get_vendor_analytics(self, vendor_id: str) -> dict:
        v_uuid = uuid.UUID(vendor_id)

        total = (await self.db.execute(
            select(func.count()).select_from(Order).where(Order.vendor_id == v_uuid)
        )).scalar_one()

        active = (await self.db.execute(
            select(func.count()).select_from(Order).where(
                Order.vendor_id == v_uuid,
                Order.status.not_in(list(_TERMINAL_STATES)),
            )
        )).scalar_one()

        completed = (await self.db.execute(
            select(func.count()).select_from(Order).where(
                Order.vendor_id == v_uuid, Order.status == OrderStatus.COMPLETED
            )
        )).scalar_one()

        rejected = (await self.db.execute(
            select(func.count()).select_from(Order).where(
                Order.vendor_id == v_uuid, Order.status == OrderStatus.VENDOR_REJECTED
            )
        )).scalar_one()

        config = await self.get_config()
        commission_rate = config["commission_rate_percent"] / 100

        # `EscrowTransaction.amount_kobo` is the full customer charge (order.total_kobo +
        # delivery_fee_kobo) — the delivery-fee portion is the rider's (paid out separately via
        # RiderPayout, see services/payment/service.py's release_rider_payout) and commission is
        # the platform's, so summing amount_kobo directly overstates vendor revenue by both. The
        # vendor's actual take per order is `order.total_kobo - commission` (release_escrow's own
        # formula) — sum `Order.total_kobo` for matching orders, then apply commission once here.
        revenue_gross = int((await self.db.execute(
            select(func.coalesce(func.sum(Order.total_kobo), 0))
            .select_from(Order)
            .join(EscrowTransaction, EscrowTransaction.order_id == Order.id)
            .where(
                Order.vendor_id == v_uuid,
                EscrowTransaction.status == EscrowStatus.RELEASED,
            )
        )).scalar_one())
        revenue = revenue_gross - int(revenue_gross * commission_rate)

        # Escrow goes HELD the instant payment is confirmed — before the vendor has even
        # accepted. Counting it as "pending" from that moment shows the vendor money that can
        # still vanish (a still-possible VENDOR_REJECTED auto-refunds the customer), so this
        # only counts orders the vendor has actually committed to fulfil.
        pending_gross = int((await self.db.execute(
            select(func.coalesce(func.sum(Order.total_kobo), 0))
            .select_from(Order)
            .join(EscrowTransaction, EscrowTransaction.order_id == Order.id)
            .where(
                Order.vendor_id == v_uuid,
                EscrowTransaction.status == EscrowStatus.HELD,
                Order.status != OrderStatus.PAID,
            )
        )).scalar_one())
        pending_release = pending_gross - int(pending_gross * commission_rate)

        return {
            "vendor_id": vendor_id,
            "total_orders": total,
            "active_orders": active,
            "completed_orders": completed,
            "total_revenue_kobo": revenue,
            "pending_release_kobo": pending_release,
            "commission_rate": commission_rate,
            "rejection_count": rejected,
            "rejection_rate_pct": round(rejected / total * 100, 2) if total > 0 else 0.0,
        }

    # ── Platform config ───────────────────────────────────────────────────────

    async def get_config(self) -> dict:
        result = await self.db.execute(
            select(PlatformConfig).where(PlatformConfig.key == "global")
        )
        row = result.scalar_one_or_none()
        if not row:
            return DEFAULT_PLATFORM_CONFIG.copy()
        # Merge over the defaults rather than trusting the stored row alone — a row saved before
        # a new config field existed would otherwise KeyError every reader of that field instead
        # of quietly falling back to its default.
        return {**DEFAULT_PLATFORM_CONFIG, **dict(row.value)}

    async def update_config(self, updates: dict, admin_id: str) -> dict:
        old_config = await self.get_config()
        new_config = {**old_config, **updates}

        result = await self.db.execute(
            select(PlatformConfig).where(PlatformConfig.key == "global")
        )
        row = result.scalar_one_or_none()
        if row:
            row.value = new_config
        else:
            self.db.add(PlatformConfig(key="global", value=new_config))

        self.db.add(
            AuditLog(
                actor_id=uuid.UUID(admin_id),
                action="config.update",
                target_type="platform_config",
                target_id="global",
                before=old_config,
                after=new_config,
            )
        )
        await self.db.flush()
        return new_config

    async def list_audit_log(self, page: int = 1, page_size: int = 20) -> tuple[list[AuditLog], int]:
        total = (await self.db.execute(
            select(func.count()).select_from(AuditLog)
        )).scalar_one()
        offset = (page - 1) * page_size
        result = await self.db.execute(
            select(AuditLog).order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total
