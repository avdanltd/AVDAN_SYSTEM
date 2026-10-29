from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, get_current_user
from services.notification.schemas import (
    NotificationResponse,
    PaginatedNotificationsResponse,
)
from services.notification.service import NotificationService

router = APIRouter()


def _notif_resp(n: object) -> NotificationResponse:
    from services.notification.models import Notification
    notif: Notification = n  # type: ignore[assignment]
    return NotificationResponse(
        id=str(notif.id),
        type=notif.type,
        channel=notif.channel,
        content=notif.content,
        read_at=notif.read_at.isoformat() if notif.read_at else None,
        created_at=notif.created_at.isoformat(),
    )


@router.get("", response_model=PaginatedNotificationsResponse)
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedNotificationsResponse:
    svc = NotificationService(db)
    notifications, total, unread = await svc.list_for_user(
        current_user.user_id, page, page_size
    )
    return PaginatedNotificationsResponse(
        items=[_notif_resp(n) for n in notifications],
        total=total,
        unread_count=unread,
        page=page,
        page_size=page_size,
    )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    svc = NotificationService(db)
    notification = await svc.mark_read(current_user.user_id, notification_id)
    return _notif_resp(notification)


@router.post("/read-all", response_model=dict)
async def mark_all_read(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    svc = NotificationService(db)
    count = await svc.mark_all_read(current_user.user_id)
    return {"marked_read": count}
