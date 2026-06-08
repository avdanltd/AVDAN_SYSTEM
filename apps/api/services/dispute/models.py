import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import BaseModel


class Dispute(BaseModel):
    __tablename__ = "disputes"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    raised_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_urls: Mapped[list] = mapped_column(
        JSONB, default=list, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="open", nullable=False
    )  # "open" | "under_review" | "resolved"
    resolution: Mapped[str | None] = mapped_column(String(30), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
