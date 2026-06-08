import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, BaseModel


class Rider(BaseModel):
    __tablename__ = "riders"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("delivery_zones.id", ondelete="SET NULL"),
        nullable=True,
    )
    online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vehicle_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8), nullable=True)
    lng: Mapped[Decimal | None] = mapped_column(Numeric(11, 8), nullable=True)


class RiderLocation(Base):
    """Append-only time-series table partitioned by day — composite PK (id, recorded_at)."""

    __tablename__ = "rider_locations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        primary_key=True,
    )
    rider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("riders.id", ondelete="CASCADE"),
        nullable=False,
    )
    lat: Mapped[Decimal] = mapped_column(Numeric(10, 8), nullable=False)
    lng: Mapped[Decimal] = mapped_column(Numeric(11, 8), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        primary_key=True,
    )
