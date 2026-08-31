"""Snapshot the product image on order items.

Order lines are deliberately snapshots: `product_name` and `price_kobo` are frozen at purchase
time so a later edit to the catalogue cannot rewrite history on an existing order. The image was
the one customer-visible field missing from that snapshot, which meant any UI wanting a thumbnail
had to join live to `products` — and would then show today's picture on a months-old order.

Backfill uses each product's current first image. That is the best available approximation for
orders placed before this column existed; from here on the value is captured at order time.

Revision ID: 0015
Revises: 0014
"""
import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "order_items",
        sa.Column("product_image_url", sa.String(length=1024), nullable=True),
    )

    # Backfill from the product's current primary image. `image_urls` is JSONB holding an array
    # of strings; ->> 0 yields the first element as text, or NULL when the array is empty.
    op.execute(
        """
        UPDATE order_items oi
        SET product_image_url = p.image_urls ->> 0
        FROM products p
        WHERE p.id = oi.product_id
          AND p.image_urls IS NOT NULL
          AND jsonb_array_length(p.image_urls) > 0
        """
    )


def downgrade() -> None:
    op.drop_column("order_items", "product_image_url")
