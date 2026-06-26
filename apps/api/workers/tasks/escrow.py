"""Escrow release tasks."""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.escrow.check_pending_releases")
def check_pending_releases() -> None:
    """Find PAYMENT_RELEASE_PENDING orders where 48h elapsed, enqueue per order."""
    asyncio.run(_check_async())


@celery_app.task(
    name="workers.tasks.escrow.release_escrow",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def release_escrow(self, order_id: str) -> None:  # type: ignore[override]
    """Release escrow for a single order. Idempotent — safe to retry."""
    asyncio.run(_release_async(order_id))


@celery_app.task(
    name="workers.tasks.escrow.refund_rejected_order",
    bind=True,
    max_retries=3,
    default_retry_delay=120,
)
def refund_rejected_order(self, order_id: str) -> None:  # type: ignore[override]
    """Automatically refund customer after vendor rejection. Idempotent."""
    asyncio.run(_refund_rejected_async(order_id))


# ── Async implementations ─────────────────────────────────────────────────────

async def _check_async() -> None:
    from sqlalchemy import select

    from core.database import AsyncSessionLocal
    from services.orders.models import Order
    from services.orders.state_machine import OrderStatus

    cutoff = datetime.now(UTC) - timedelta(hours=48)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Order.id).where(
                Order.status == OrderStatus.PAYMENT_RELEASE_PENDING,
                Order.updated_at <= cutoff,
            )
        )
        order_ids = [str(row[0]) for row in result.all()]

    for order_id in order_ids:
        release_escrow.delay(order_id)


async def _refund_rejected_async(order_id: str) -> None:
    from sqlalchemy import select

    from core.database import AsyncSessionLocal
    from services.orders.models import Order
    from services.orders.state_machine import OrderStatus
    from services.payment.service import PaymentService

    async with AsyncSessionLocal() as db:
        async with db.begin():
            result = await db.execute(select(Order).where(Order.id == __import__("uuid").UUID(order_id)))
            order = result.scalar_one_or_none()
            if not order or order.status != OrderStatus.VENDOR_REJECTED:
                return
            svc = PaymentService(db)
            escrow = await svc._get_escrow_for_order(order_id)
            if not escrow:
                return
            # Transition to REFUND_INITIATED and attempt Paystack refund
            try:
                await svc.process_refund(
                    order_id,
                    escrow.amount_kobo,
                    admin_id="00000000-0000-0000-0000-000000000000",
                    reason="Vendor rejected the order — automatic refund",
                )
            except Exception:
                pass


async def _release_async(order_id: str) -> None:
    from core.database import AsyncSessionLocal
    from services.payment.service import PaymentService

    async with AsyncSessionLocal() as db:
        async with db.begin():
            svc = PaymentService(db)
            await svc.release_escrow(order_id)
