"""categories: optional parent (one level of sub-categories); products: special delivery fee

Revision ID: 0024
Revises: 0023
Create Date: 2026-11-09

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "categories",
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_categories_parent_id", "categories", "categories", ["parent_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_categories_parent_id", "categories", ["parent_id"])
    # Extra delivery charge per unit for bulky or awkward products; 0 = none.
    op.add_column(
        "products",
        sa.Column("special_delivery_fee_kobo", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("products", "special_delivery_fee_kobo")
    op.drop_index("ix_categories_parent_id", table_name="categories")
    op.drop_constraint("fk_categories_parent_id", "categories", type_="foreignkey")
    op.drop_column("categories", "parent_id")
