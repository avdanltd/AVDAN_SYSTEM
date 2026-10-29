"""Notification service — DB operations only. Push dispatch is in Celery task."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import NotFoundException
from services.notification.models import Notification


class NotificationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_user(
        self, user_id: str, page: int, page_size: int
    ) -> tuple[list[Notification], int, int]:
        """Returns (notifications, total, unread_count)."""
        user_uuid = uuid.UUID(user_id)

        total_result = await self.db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.user_id == user_uuid
            )
        )
        total = total_result.scalar_one()

        unread_result = await self.db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.user_id == user_uuid,
                Notification.read_at.is_(None),
            )
        )
        unread_count = unread_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_uuid)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        notifications = list(result.scalars().all())
        return notifications, total, unread_count

    async def mark_read(self, user_id: str, notification_id: str) -> Notification:
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == uuid.UUID(notification_id),
                Notification.user_id == uuid.UUID(user_id),
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise NotFoundException("Notification not found")
        if not notification.read_at:
            notification.read_at = datetime.now(UTC)
        return notification

    async def mark_all_read(self, user_id: str) -> int:
        """Marks all unread notifications as read. Returns count updated."""
        result = await self.db.execute(
            select(Notification).where(
                Notification.user_id == uuid.UUID(user_id),
                Notification.read_at.is_(None),
            )
        )
        notifications = result.scalars().all()
        now = datetime.now(UTC)
        for n in notifications:
            n.read_at = now
        return len(notifications)
