from __future__ import annotations

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: str
    type: str
    channel: str
    content: dict
    read_at: str | None
    created_at: str

    model_config = {"from_attributes": True}


class PaginatedNotificationsResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int


class PushTokenRequest(BaseModel):
    token: str = Field(min_length=1)
