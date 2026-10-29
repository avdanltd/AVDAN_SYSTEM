"""product approval and markup: vendor price vs admin-set shown price

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-29

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # products.price_kobo stays the price customers see and pay; vendor_price_kobo is what the
    # vendor asked for and is paid. Existing products keep their price as both (markup 0) and
    # stay live, so nothing disappears from the site when this ships.
    op.add_column("products", sa.Column("vendor_price_kobo", sa.Integer(), nullable=True))
    op.execute("UPDATE products SET vendor_price_kobo = price_kobo")
    op.alter_column("products", "vendor_price_kobo", nullable=False)
    op.add_column(
        "products",
        sa.Column("approval_status", sa.String(16), nullable=False, server_default="APPROVED"),
    )
    op.add_column("products", sa.Column("rejection_reason", sa.String(500), nullable=True))
    op.create_index("ix_products_approval_status", "products", ["approval_status"])

    # Snapshots on the order, nullable: orders placed before this have no vendor-price snapshot
    # and keep the old commission-rate payout.
    op.add_column("order_items", sa.Column("vendor_price_kobo", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("vendor_total_kobo", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "vendor_total_kobo")
    op.drop_column("order_items", "vendor_price_kobo")
    op.drop_index("ix_products_approval_status", table_name="products")
    op.drop_column("products", "rejection_reason")
    op.drop_column("products", "approval_status")
    op.drop_column("products", "vendor_price_kobo")
