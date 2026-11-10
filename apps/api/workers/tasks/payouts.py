"""Payout reconciliation — settles withdrawals whose Paystack transfer.* webhook never arrived."""
from __future__ import annotations

import asyncio
import logging

from workers import run_and_dispose
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="workers.tasks.payouts.reconcile_processing_payouts")
def reconcile_processing_payouts() -> None:
    """Ask Paystack about every payout stuck in PROCESSING. Idempotent — safe to run any time."""
    asyncio.run(run_and_dispose(_reconcile_async()))


async def _reconcile_async() -> None:
    from core.database import AsyncSessionLocal
    from services.wallet.service import WalletService

    async with AsyncSessionLocal() as db:
        async with db.begin():
            changed = await WalletService(db).reconcile_processing()
    if changed:
        logger.info("payout reconciliation settled %d request(s)", changed)
