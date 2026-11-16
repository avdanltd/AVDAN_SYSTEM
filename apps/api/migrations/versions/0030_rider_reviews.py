"""rider ratings: reviews.rider_id + riders.rating/review_count

Revision ID: 0030
Revises: 0029
Create Date: 2026-11-16

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reviews",
        sa.Column("rider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("riders.id", ondelete="CASCADE"), nullable=True),
    )
    # One rider rating per order, like the one vendor rating per order.
    op.create_index(
        "uq_reviews_order_rider", "reviews", ["order_id"],
        unique=True, postgresql_where=sa.text("target_type = 'rider'"),
    )
    op.create_index("ix_reviews_rider", "reviews", ["rider_id", "status"])
    op.add_column("riders", sa.Column("rating", sa.Numeric(3, 2), nullable=False, server_default="0"))
    op.add_column("riders", sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("riders", "review_count")
    op.drop_column("riders", "rating")
    op.drop_index("ix_reviews_rider", table_name="reviews")
    op.drop_index("uq_reviews_order_rider", table_name="reviews")
    op.drop_column("reviews", "rider_id")
