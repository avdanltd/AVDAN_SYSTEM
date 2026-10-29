"""order delivery_code: handover confirmation code the customer reads to the rider

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-29

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable on purpose: orders placed before this migration have no code, and the rider
    # deliver step skips the check for them rather than stranding in-flight orders.
    op.add_column("orders", sa.Column("delivery_code", sa.String(6), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "delivery_code")
