"""businesses + branch link requests: group independent vendor accounts under one brand

Revision ID: 0032
Revises: 0031
Create Date: 2026-11-22

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "businesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_businesses_slug", "businesses", ["slug"], unique=True)

    op.add_column(
        "vendors",
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_vendors_business_id", "vendors", ["business_id"])

    op.create_table(
        "business_link_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("target_vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("brand_name", sa.String(255), nullable=True),
        sa.Column("note", sa.String(1000), nullable=True),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_business_link_requests_vendor_id", "business_link_requests", ["vendor_id"])
    # A vendor can have only one request waiting at a time.
    op.create_index(
        "uq_business_link_requests_one_pending", "business_link_requests", ["vendor_id"],
        unique=True, postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("uq_business_link_requests_one_pending", table_name="business_link_requests")
    op.drop_index("ix_business_link_requests_vendor_id", table_name="business_link_requests")
    op.drop_table("business_link_requests")
    op.drop_index("ix_vendors_business_id", table_name="vendors")
    op.drop_column("vendors", "business_id")
    op.drop_index("ix_businesses_slug", table_name="businesses")
    op.drop_table("businesses")
