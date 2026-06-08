"""agent_hubs, qa_inspections, orders.hub_id FK, users.hub_id

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-06

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "agent_hubs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "zone_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("delivery_zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("lng", sa.Numeric(11, 8), nullable=True),
        sa.Column("capacity", sa.Integer, server_default=sa.text("100"), nullable=False),
        sa.Column("active", sa.Boolean, server_default=sa.text("true"), nullable=False),
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
        "qa_inspections",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "agent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "hub_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agent_hubs.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("result", sa.String(20), server_default="pending", nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "evidence_urls",
            postgresql.JSONB,
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
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
    op.create_index("ix_qa_inspections_order_id", "qa_inspections", ["order_id"])
    op.create_index("ix_qa_inspections_hub_id", "qa_inspections", ["hub_id"])

    # FK on orders.hub_id now that agent_hubs table exists
    op.create_foreign_key(
        "fk_orders_hub_id",
        "orders",
        "agent_hubs",
        ["hub_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Assign agents to a specific hub
    op.add_column(
        "users",
        sa.Column(
            "hub_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agent_hubs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "hub_id")
    op.drop_constraint("fk_orders_hub_id", "orders", type_="foreignkey")
    op.drop_index("ix_qa_inspections_hub_id", "qa_inspections")
    op.drop_index("ix_qa_inspections_order_id", "qa_inspections")
    op.drop_table("qa_inspections")
    op.drop_table("agent_hubs")
