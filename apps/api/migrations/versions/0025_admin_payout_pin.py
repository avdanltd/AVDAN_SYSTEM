"""users: admin payout PIN + lockout counters

Revision ID: 0025
Revises: 0024
Create Date: 2026-11-10

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("payout_pin_hash", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("payout_pin_failed_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("payout_pin_locked_until", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "payout_pin_locked_until")
    op.drop_column("users", "payout_pin_failed_attempts")
    op.drop_column("users", "payout_pin_hash")
