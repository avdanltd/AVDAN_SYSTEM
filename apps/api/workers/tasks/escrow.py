"""Escrow release tasks — implemented in Phase 5."""
from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.escrow.check_pending_releases")
def check_pending_releases() -> None:
    """Find orders in PAYMENT_RELEASE_PENDING where 48h elapsed, enqueue release per order."""
    raise NotImplementedError("Implemented in Phase 5")


@celery_app.task(name="workers.tasks.escrow.release_escrow", bind=True, max_retries=3)
def release_escrow(self, order_id: str) -> None:  # type: ignore[override]
    """Release escrow for a single order. Idempotent — safe to retry."""
    raise NotImplementedError("Implemented in Phase 5")
