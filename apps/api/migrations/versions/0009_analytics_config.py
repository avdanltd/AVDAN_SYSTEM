"""platform_config, audit_log, analytics indexes

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-06

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "platform_config",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("key", sa.String(50), nullable=False, unique=True),
        sa.Column("value", postgresql.JSONB, nullable=False),
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
    )

    op.create_table(
        "audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("target_type", sa.String(60), nullable=False),
        sa.Column("target_id", sa.String(100), nullable=True),
        sa.Column("before", postgresql.JSONB, nullable=True),
        sa.Column("after", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_audit_log_actor_id", "audit_log", ["actor_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])

    # Analytics read-optimisation indexes
    op.create_index("ix_orders_created_at", "orders", ["created_at"])
    op.create_index("ix_orders_vendor_created", "orders", ["vendor_id", "created_at"])
    op.create_index(
        "ix_escrow_status_created",
        "escrow_transactions",
        ["status", "created_at"],
    )

    # Seed the singleton config row with defaults
    op.execute("""
        INSERT INTO platform_config (key, value)
        VALUES ('global', '{
            "commission_rate_percent": 10,
            "delivery_fee_structure": {
                "base_fee_kobo": 50000,
                "per_km_kobo": 10000
            },
            "escrow_release_hours": 48,
            "order_cancellation_window_minutes": 30
        }'::jsonb)
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_index("ix_escrow_status_created", "escrow_transactions")
    op.drop_index("ix_orders_vendor_created", "orders")
    op.drop_index("ix_orders_created_at", "orders")
    op.drop_index("ix_audit_log_action", "audit_log")
    op.drop_index("ix_audit_log_actor_id", "audit_log")
    op.drop_table("audit_log")
    op.drop_table("platform_config")
