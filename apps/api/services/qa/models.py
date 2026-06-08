import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import BaseModel


class AgentHub(BaseModel):
    __tablename__ = "agent_hubs"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("delivery_zones.id", ondelete="SET NULL"),
        nullable=True,
    )
    lat: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    lng: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class QAInspection(BaseModel):
    __tablename__ = "qa_inspections"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    hub_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agent_hubs.id", ondelete="RESTRICT"),
        nullable=False,
    )
    result: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )  # "pending" | "pass" | "fail"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_urls: Mapped[list] = mapped_column(
        JSONB, default=list, nullable=False
    )
