import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import BaseModel


class EscrowStatus:
    INITIATED = "INITIATED"
    HELD = "HELD"
    PAYOUT_PENDING = "PAYOUT_PENDING"  # transfer queued at Paystack, awaiting transfer.success/failed
    RELEASED = "RELEASED"
    REFUNDED = "REFUNDED"
    FAILED = "FAILED"


class EscrowTransaction(BaseModel):
    __tablename__ = "escrow_transactions"
    __table_args__ = (
        UniqueConstraint("provider", "provider_ref", name="uq_escrow_provider_ref"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    provider_ref: Mapped[str] = mapped_column(String(100), nullable=False)
    provider_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    amount_kobo: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default=EscrowStatus.INITIATED, nullable=False
    )


class RiderPayoutStatus:
    PENDING = "PENDING"  # fee owed, no transfer attempted yet
    PAYOUT_PENDING = "PAYOUT_PENDING"  # transfer queued at Paystack, awaiting transfer.success/failed
    RELEASED = "RELEASED"
    FAILED = "FAILED"  # transfer failed, or rider has no payout account configured


class RiderPayout(BaseModel):
    """The rider's side of an order's money movement — kept as its own table rather than a
    second row on escrow_transactions, since every existing PaymentService query assumes exactly
    one escrow row per order (`_get_escrow_for_order` uses `.scalar_one_or_none()`). Mirrors
    EscrowTransaction's status lifecycle so release_escrow's pending/webhook-confirms pattern
    applies unchanged; failure here never blocks or is blocked by the vendor's payout."""

    __tablename__ = "rider_payouts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_ref", name="uq_rider_payout_provider_ref"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    rider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("riders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    provider: Mapped[str | None] = mapped_column(String(30), nullable=True)
    provider_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    provider_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    amount_kobo: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default=RiderPayoutStatus.PENDING, nullable=False
    )
