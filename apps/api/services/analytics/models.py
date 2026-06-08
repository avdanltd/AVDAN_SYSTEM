import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, BaseModel

# Default platform-wide settings — used when no DB row exists yet
DEFAULT_PLATFORM_CONFIG: dict = {
    "commission_rate_percent": 10,
    "delivery_fee_structure": {
        "base_fee_kobo": 50000,
        "per_km_kobo": 10000,
    },
    "escrow_release_hours": 48,
    "order_cancellation_window_minutes": 30,
}


class PlatformConfig(BaseModel):
    """Singleton config row — key is always 'global'."""

    __tablename__ = "platform_config"

    key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)


class AuditLog(Base):
    """Append-only audit trail — no updated_at by design."""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    target_type: Mapped[str] = mapped_column(String(60), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    before: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
