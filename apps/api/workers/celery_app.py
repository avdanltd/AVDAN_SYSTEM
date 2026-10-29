import os
import sys

# Ensure the apps/api directory is in Python's search path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

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
        "workers.tasks.embeddings",
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

import workers.beat_schedule  # noqa: F401, E402 — activates beat schedule entries

# Register every SQLAlchemy model module once, in the master process, before the
# prefork pool forks its children. Each forked worker gets its own independent
# mapper registry (it's a separate OS process), and any task that touches a
# relationship SQLAlchemy hasn't configured yet in *that* process crashes with
# InvalidRequestError (e.g. Product.category -> 'Category' unresolved) the first
# time it runs — nondeterministically, depending on which task that worker
# happens to execute first. Importing every models module here, ahead of the
# fork, means the registry is fully built exactly once and inherited by every
# child via copy-on-write, so no individual task module needs its own guard
# import. (workers.tasks.embeddings still carries a local guard import as
# belt-and-suspenders — safe to keep, redundant with this.)
import services.analytics.models  # noqa: F401, E402
import services.auth.models  # noqa: F401, E402
import services.categories.models  # noqa: F401, E402
import services.dispatch.models  # noqa: F401, E402
import services.dispute.models  # noqa: F401, E402
import services.notification.models  # noqa: F401, E402
import services.orders.models  # noqa: F401, E402
import services.payment.models  # noqa: F401, E402
import services.qa.models  # noqa: F401, E402
import services.vendor.models  # noqa: F401, E402
