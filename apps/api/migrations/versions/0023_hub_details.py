"""agent_hubs: address and a free-text description, filled in by the hub itself

Revision ID: 0023
Revises: 0022
Create Date: 2026-10-30

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("agent_hubs", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("agent_hubs", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("agent_hubs", "description")
    op.drop_column("agent_hubs", "address")
