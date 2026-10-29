"""riders, rider_locations (partitioned), orders.rider_id FK

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-05

"""
from collections.abc import Sequence
from datetime import date, timedelta

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "riders",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "zone_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("delivery_zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("online", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("vehicle_type", sa.String(50), nullable=True),
        sa.Column("lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("lng", sa.Numeric(11, 8), nullable=True),
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
    op.create_index("ix_riders_zone_id", "riders", ["zone_id"])
    op.create_index("ix_riders_online", "riders", ["online"])

    # rider_locations: partitioned time-series table
    op.execute("""
        CREATE TABLE rider_locations (
            id          UUID NOT NULL DEFAULT gen_random_uuid(),
            rider_id    UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
            lat         DECIMAL(10, 8) NOT NULL,
            lng         DECIMAL(11, 8) NOT NULL,
            recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id, recorded_at)
        ) PARTITION BY RANGE (recorded_at)
    """)
    op.execute("CREATE INDEX ix_rider_locations_rider_id ON rider_locations (rider_id, recorded_at)")

    # Create daily partitions for today + next 30 days
    today = date.today()
    for i in range(31):
        day = today + timedelta(days=i)
        next_day = day + timedelta(days=1)
        partition_name = f"rider_locations_{day.strftime('%Y%m%d')}"
        op.execute(f"""
            CREATE TABLE {partition_name}
            PARTITION OF rider_locations
            FOR VALUES FROM ('{day}') TO ('{next_day}')
        """)

    # Add FK constraint to orders.rider_id now that riders table exists
    op.create_foreign_key(
        "fk_orders_rider_id",
        "orders",
        "riders",
        ["rider_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_orders_rider_id", "orders", type_="foreignkey")
    op.execute("DROP TABLE IF EXISTS rider_locations CASCADE")
    op.drop_index("ix_riders_online", "riders")
    op.drop_index("ix_riders_zone_id", "riders")
    op.drop_table("riders")
