"""pgvector extension + embedding columns on products and vendors

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-26

"""
from collections.abc import Sequence

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Add embedding columns — nullable until Celery backfill runs
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(384)")
    op.execute("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS embedding vector(384)")

    # IVFFlat indexes for approximate nearest-neighbour cosine search.
    # lists=100 is appropriate for up to ~1M rows; rebuild when data grows.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_products_embedding "
        "ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_vendors_embedding "
        "ON vendors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_vendors_embedding")
    op.execute("DROP INDEX IF EXISTS ix_products_embedding")
    op.execute("ALTER TABLE vendors DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS embedding")
    # Leave the extension — other tables might use it
