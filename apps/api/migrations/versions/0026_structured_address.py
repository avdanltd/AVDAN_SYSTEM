"""vendors + agent_hubs: structured address (street, city, LGA, state, country, landmark)

Revision ID: 0026
Revises: 0025
Create Date: 2026-11-10

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = [
    ("street", 200), ("city", 100), ("lga", 100), ("state", 50), ("country", 50), ("landmark", 200),
]


def upgrade() -> None:
    for table in ("vendors", "agent_hubs"):
        for name, length in _COLUMNS:
            op.add_column(table, sa.Column(name, sa.String(length), nullable=True))


def downgrade() -> None:
    for table in ("vendors", "agent_hubs"):
        for name, _ in reversed(_COLUMNS):
            op.drop_column(table, name)
