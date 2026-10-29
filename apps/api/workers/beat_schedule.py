"""Celery Beat schedule — tasks added per phase as they are implemented."""
from celery.schedules import crontab

from workers.celery_app import celery_app

# Phase 5: Escrow release — every 15 minutes check for orders ready for release
celery_app.conf.beat_schedule["release-escrow"] = {
    "task": "workers.tasks.escrow.check_pending_releases",
    "schedule": crontab(minute="*/15"),
}

# Phase 6: Purge old rider_location partitions — daily at 2am
celery_app.conf.beat_schedule["purge-location-partitions"] = {
    "task": "workers.tasks.cleanup.purge_old_rider_partitions",
    "schedule": crontab(hour=2, minute=0),
}
