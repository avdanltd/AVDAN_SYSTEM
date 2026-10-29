import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, BaseModel


class WalletOwner:
    VENDOR = "vendor"
    RIDER = "rider"


class WalletEntryKind:
    ORDER_CREDIT = "ORDER_CREDIT"  # + earnings land in Available
    WITHDRAWAL_HOLD = "WITHDRAWAL_HOLD"  # - moved out of Available into a payout request
    WITHDRAWAL_RELEASE = "WITHDRAWAL_RELEASE"  # + admin rejected / approved less than requested
    WITHDRAWAL_REVERSAL = "WITHDRAWAL_REVERSAL"  # + Paystack transfer failed after approval


class PayoutStatus:
    REQUESTED = "REQUESTED"  # waiting for an admin
    PROCESSING = "PROCESSING"  # approved, transfer queued at Paystack
    PAID = "PAID"  # transfer.success received
    REJECTED = "REJECTED"
    FAILED = "FAILED"  # transfer failed/reversed — money is back in Available


class PayoutEventType:
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    TRANSFER_SUCCESS = "TRANSFER_SUCCESS"
    TRANSFER_FAILED = "TRANSFER_FAILED"


class WalletEntry(Base):
    """Append-only money ledger. Never updated or deleted — a balance is always a SUM over rows,
    so it cannot drift from the history that explains it. `amount_kobo` is signed relative to the
    owner's Available balance. owner_id is polymorphic (vendors.id or riders.id) so it carries no FK."""

    __tablename__ = "wallet_entries"
    __table_args__ = (
        Index("ix_wallet_entries_owner", "owner_type", "owner_id", "created_at"),
        # One earning credit per order per owner — makes crediting safe to retry.
        Index(
            "uq_wallet_order_credit",
            "owner_type", "owner_id", "order_id",
            unique=True,
            postgresql_where=text("kind = 'ORDER_CREDIT'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    owner_type: Mapped[str] = mapped_column(String(10), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    amount_kobo: Mapped[int] = mapped_column(Integer, nullable=False)
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="RESTRICT"), nullable=True
    )
    payout_request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payout_requests.id", ondelete="RESTRICT"), nullable=True
    )
    entry_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PayoutRequest(BaseModel):
    """A vendor's or rider's withdrawal request. Nothing moves to a bank until an admin approves
    an amount — there are no automatic payouts anywhere."""

    __tablename__ = "payout_requests"
    __table_args__ = (Index("ix_payout_requests_owner", "owner_type", "owner_id"),)

    owner_type: Mapped[str] = mapped_column(String(10), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    requested_kobo: Mapped[int] = mapped_column(Integer, nullable=False)
    approved_kobo: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=PayoutStatus.REQUESTED, nullable=False, index=True
    )
    # Bank account snapshot — taken at request time, retaken at approval (what was actually paid).
    destination: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    transfer_ref: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class PayoutRequestEvent(Base):
    """Append-only audit trail for a payout request — who did what, when, for how much."""

    __tablename__ = "payout_request_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    payout_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payout_requests.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    event: Mapped[str] = mapped_column(String(30), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_role: Mapped[str] = mapped_column(String(20), nullable=False)  # vendor|rider|admin|system
    amount_kobo: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
