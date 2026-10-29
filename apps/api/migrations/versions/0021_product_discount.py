"""product discount: platform-funded discount set by admin at approval

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-29

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # price_kobo stays what customers pay (already discounted). compare_at_price_kobo is the
    # pre-discount price shown struck through; null means no discount.
    op.add_column("products", sa.Column("compare_at_price_kobo", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("discount_type", sa.String(8), nullable=True))
    op.add_column("products", sa.Column("discount_value", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "discount_value")
    op.drop_column("products", "discount_type")
    op.drop_column("products", "compare_at_price_kobo")
