"""review_reports: users can flag a review for admin moderation

Revision ID: 0033
Revises: 0032
Create Date: 2026-11-22

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0033"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "review_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("review_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(12), nullable=False),
        sa.Column("details", sa.String(500), nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("uq_review_reports_one_per_person", "review_reports", ["review_id", "reporter_id"], unique=True)
    op.create_index("ix_review_reports_status", "review_reports", ["status"])


def downgrade() -> None:
    op.drop_index("ix_review_reports_status", table_name="review_reports")
    op.drop_index("uq_review_reports_one_per_person", table_name="review_reports")
    op.drop_table("review_reports")
