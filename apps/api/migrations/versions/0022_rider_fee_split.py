"""orders.rider_fee_kobo: rider's share of the delivery fee after AVDAN's delivery commission

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-30

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Null on existing orders: they keep paying the rider the whole delivery fee.
    op.add_column("orders", sa.Column("rider_fee_kobo", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "rider_fee_kobo")
