"""vendor payout account columns

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-09

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("vendors", sa.Column("payout_account_number", sa.String(20), nullable=True))
    op.add_column("vendors", sa.Column("payout_bank_name", sa.String(150), nullable=True))
    op.add_column("vendors", sa.Column("payout_account_name", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("vendors", "payout_account_name")
    op.drop_column("vendors", "payout_bank_name")
    op.drop_column("vendors", "payout_account_number")
