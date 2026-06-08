"""escrow_transactions + vendor paystack_recipient_code

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-05

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "escrow_transactions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("provider_ref", sa.String(100), nullable=False),
        sa.Column("provider_metadata", postgresql.JSONB, nullable=True),
        sa.Column("amount_kobo", sa.Integer, nullable=False),
        sa.Column("status", sa.String(30), server_default="INITIATED", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("provider", "provider_ref", name="uq_escrow_provider_ref"),
    )
    op.create_index("ix_escrow_order_id", "escrow_transactions", ["order_id"])

    # Vendor payout: Paystack recipient code required for escrow release transfers
    op.add_column(
        "vendors",
        sa.Column("paystack_recipient_code", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("vendors", "paystack_recipient_code")
    op.drop_index("ix_escrow_order_id", "escrow_transactions")
    op.drop_table("escrow_transactions")
