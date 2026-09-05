"""Vendor address + coordinates — needed for proximity-based rider/hub auto-assignment.

Vendor previously only carried `zone_id`, which is too coarse to rank riders or hubs by actual
distance. Adds a free-text address plus geocoded lat/lng (nullable — geocoding is best-effort at
registration time and can fail; a vendor missing coordinates just falls back to zone-based
matching, same as before this migration).

Revision ID: 0016
Revises: 0015
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("vendors", sa.Column("address", sa.String(length=500), nullable=True))
    op.add_column("vendors", sa.Column("lat", sa.Numeric(10, 8), nullable=True))
    op.add_column("vendors", sa.Column("lng", sa.Numeric(11, 8), nullable=True))


def downgrade() -> None:
    op.drop_column("vendors", "lng")
    op.drop_column("vendors", "lat")
    op.drop_column("vendors", "address")
