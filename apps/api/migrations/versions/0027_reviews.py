"""reviews and ratings: reviews table; products.rating/review_count; vendors.review_count

Revision ID: 0027
Revises: 0026
Create Date: 2026-11-10

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=True),
        sa.Column("target_type", sa.String(10), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("order_outcome", sa.String(40), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="visible"),
        sa.Column("hidden_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hidden_reason", sa.Text(), nullable=True),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
    )
    op.create_index(
        "uq_reviews_order_product", "reviews", ["order_id", "product_id"],
        unique=True, postgresql_where=sa.text("target_type = 'product'"),
    )
    op.create_index(
        "uq_reviews_order_vendor", "reviews", ["order_id"],
        unique=True, postgresql_where=sa.text("target_type = 'vendor'"),
    )
    op.create_index("ix_reviews_product", "reviews", ["product_id", "status"])
    op.create_index("ix_reviews_vendor", "reviews", ["vendor_id", "status"])

    op.add_column("products", sa.Column("rating", sa.Numeric(3, 2), nullable=False, server_default="0"))
    op.add_column("products", sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("vendors", sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("vendors", "review_count")
    op.drop_column("products", "review_count")
    op.drop_column("products", "rating")
    op.drop_index("ix_reviews_vendor", table_name="reviews")
    op.drop_index("ix_reviews_product", table_name="reviews")
    op.drop_index("uq_reviews_order_vendor", table_name="reviews")
    op.drop_index("uq_reviews_order_product", table_name="reviews")
    op.drop_table("reviews")
