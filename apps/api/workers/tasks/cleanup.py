"""Housekeeping tasks — implemented in Phase 6."""
from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.cleanup.purge_old_rider_partitions")
def purge_old_rider_partitions() -> None:
    raise NotImplementedError("Implemented in Phase 6")
