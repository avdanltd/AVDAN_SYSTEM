"""vendor/rider wallet ledger, payout requests, order delivery_quote

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-28

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # How the delivery fee was worked out (legs vendor->hub->customer, rates used). Stored beside
    # delivery_fee_kobo so a later rate change never makes an old order's fee unexplainable.
    op.add_column("orders", sa.Column("delivery_quote", postgresql.JSONB(), nullable=True))

    op.create_table(
        "payout_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_type", sa.String(10), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("requested_kobo", sa.Integer(), nullable=False),
        sa.Column("approved_kobo", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="REQUESTED"),
        sa.Column("destination", postgresql.JSONB(), nullable=True),
        sa.Column("decided_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("transfer_ref", sa.String(100), nullable=True, unique=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payout_requests_status", "payout_requests", ["status"])
    op.create_index("ix_payout_requests_owner", "payout_requests", ["owner_type", "owner_id"])

    op.create_table(
        "wallet_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_type", sa.String(10), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("amount_kobo", sa.Integer(), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("payout_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payout_requests.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_wallet_entries_owner", "wallet_entries", ["owner_type", "owner_id", "created_at"])
    op.create_index(
        "uq_wallet_order_credit", "wallet_entries", ["owner_type", "owner_id", "order_id"],
        unique=True, postgresql_where=sa.text("kind = 'ORDER_CREDIT'"),
    )

    op.create_table(
        "payout_request_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("payout_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payout_requests.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("event", sa.String(30), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_role", sa.String(20), nullable=False),
        sa.Column("amount_kobo", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payout_request_events_request", "payout_request_events", ["payout_request_id"])


def downgrade() -> None:
    op.drop_table("payout_request_events")
    op.drop_table("wallet_entries")
    op.drop_table("payout_requests")
    op.drop_column("orders", "delivery_quote")
