from celery import Celery

from core.config import settings

celery_app = Celery(
    "avdan",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "workers.tasks.health",
        "workers.tasks.escrow",
        "workers.tasks.notifications",
        "workers.tasks.cleanup",
    ],
)

celery_app.config_from_object(
    {
        "task_serializer": "json",
        "result_serializer": "json",
        "accept_content": ["json"],
        "timezone": "Africa/Lagos",
        "enable_utc": True,
        "task_track_started": True,
    }
)

celery_app.conf.beat_schedule = {}  # populated in beat_schedule.py
