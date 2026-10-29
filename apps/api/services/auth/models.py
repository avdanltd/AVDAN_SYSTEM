import uuid
from typing import TYPE_CHECKING, Literal

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import BaseModel

if TYPE_CHECKING:
    pass

UserRole = Literal["customer", "vendor", "rider", "agent", "admin", "support"]
UserStatus = Literal["pending", "active", "suspended", "banned"]


class User(BaseModel):
    __tablename__ = "users"

    role: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hub_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )  # set for agent role users; FK to agent_hubs added in Phase 8 migration

    vendor_profile: Mapped["VendorProfile | None"] = relationship(
        "VendorProfile", back_populates="user", uselist=False
    )
    rider_profile: Mapped["RiderProfile | None"] = relationship(
        "RiderProfile", back_populates="user", uselist=False
    )


class VendorProfile(BaseModel):
    __tablename__ = "vendor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="vendor_profile")


class RiderProfile(BaseModel):
    __tablename__ = "rider_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    user: Mapped["User"] = relationship("User", back_populates="rider_profile")
