"""Analytics and platform config service."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from services.analytics.models import AuditLog, DEFAULT_PLATFORM_CONFIG, PlatformConfig
from services.dispatch.models import Rider
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

        revenue_today = int((await self.db.execute(
            select(func.coalesce(func.sum(EscrowTransaction.amount_kobo), 0)).where(
                EscrowTransaction.status == EscrowStatus.RELEASED,
                EscrowTransaction.created_at >= today_start,
            )
        )).scalar_one())

        gmv_today = int((await self.db.execute(
            select(func.coalesce(func.sum(Order.total_kobo), 0)).where(
                Order.created_at >= today_start
            )
        )).scalar_one())

        return {
            "active_orders": active_orders,
            "riders_online": riders_online,
            "revenue_today_kobo": revenue_today,
            "gmv_today_kobo": gmv_today,
        }

    async def get_order_volume(self, period: str = "day") -> dict:
        trunc = period if period in ("day", "week", "month") else "day"
        if trunc == "week":
            since = datetime.now(UTC) - timedelta(weeks=12)
        elif trunc == "month":
            since = datetime.now(UTC) - timedelta(days=365)
        else:
            since = datetime.now(UTC) - timedelta(days=30)

        result = await self.db.execute(
            select(
                func.date_trunc(trunc, Order.created_at).label("period"),
                func.count().label("order_count"),
                func.coalesce(func.sum(Order.total_kobo), 0).label("volume_kobo"),
            )
            .where(Order.created_at >= since)
            .group_by(func.date_trunc(trunc, Order.created_at))
            .order_by(func.date_trunc(trunc, Order.created_at))
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

        revenue = int((await self.db.execute(
            select(func.coalesce(func.sum(EscrowTransaction.amount_kobo), 0))
            .join(Order, Order.id == EscrowTransaction.order_id)
            .where(
                Order.vendor_id == v_uuid,
                EscrowTransaction.status == EscrowStatus.RELEASED,
            )
        )).scalar_one())

        pending_release = int((await self.db.execute(
            select(func.coalesce(func.sum(EscrowTransaction.amount_kobo), 0))
            .join(Order, Order.id == EscrowTransaction.order_id)
            .where(
                Order.vendor_id == v_uuid,
                EscrowTransaction.status == EscrowStatus.HELD,
            )
        )).scalar_one())

        from core.config import settings
        commission_rate = settings.commission_rate_percent / 100

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
        return dict(row.value) if row else DEFAULT_PLATFORM_CONFIG.copy()

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
