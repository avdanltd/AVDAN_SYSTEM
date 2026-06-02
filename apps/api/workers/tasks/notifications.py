"""Notification tasks — implemented in Phase 7."""
from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.notifications.send_notification")
def send_notification(user_id: str, notification_type: str, payload: dict) -> None:  # type: ignore[type-arg]
    raise NotImplementedError("Implemented in Phase 7")
