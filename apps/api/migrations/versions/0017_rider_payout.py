"""rider payout account, delivery fee, rider_payouts table

Revision ID: 0017
Revises: 0016
Create Date: 2026-09-17

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Riders had no payout mechanism at all — mirrors vendors' payout columns exactly
    # (migration 0010_vendor_payout_columns).
    op.add_column("riders", sa.Column("paystack_recipient_code", sa.String(100), nullable=True))
    op.add_column("riders", sa.Column("payout_account_number", sa.String(20), nullable=True))
    op.add_column("riders", sa.Column("payout_bank_name", sa.String(150), nullable=True))
    op.add_column("riders", sa.Column("payout_account_name", sa.String(200), nullable=True))

    op.add_column(
        "orders",
        sa.Column("delivery_fee_kobo", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "rider_payouts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("rider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("riders.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("provider", sa.String(30), nullable=True),
        sa.Column("provider_ref", sa.String(100), nullable=True),
        sa.Column("provider_metadata", postgresql.JSONB(), nullable=True),
        sa.Column("amount_kobo", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("provider", "provider_ref", name="uq_rider_payout_provider_ref"),
    )
    op.create_index("ix_rider_payouts_order_id", "rider_payouts", ["order_id"])
    op.create_index("ix_rider_payouts_rider_id", "rider_payouts", ["rider_id"])
    op.create_index("ix_rider_payouts_status", "rider_payouts", ["status"])


def downgrade() -> None:
    op.drop_index("ix_rider_payouts_status", table_name="rider_payouts")
    op.drop_index("ix_rider_payouts_rider_id", table_name="rider_payouts")
    op.drop_index("ix_rider_payouts_order_id", table_name="rider_payouts")
    op.drop_table("rider_payouts")

    op.drop_column("orders", "delivery_fee_kobo")

    op.drop_column("riders", "payout_account_name")
    op.drop_column("riders", "payout_bank_name")
    op.drop_column("riders", "payout_account_number")
    op.drop_column("riders", "paystack_recipient_code")
