"""search indexing optimizations

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-30

"""
from collections.abc import Sequence

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Enable pg_trgm extension for fast LIKE/ILIKE searches using trigrams
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # 2. Drop existing IVFFlat indexes
    op.execute("DROP INDEX IF EXISTS ix_products_embedding")
    op.execute("DROP INDEX IF EXISTS ix_vendors_embedding")

    # 3. Create HNSW indexes (much better recall/performance & dynamically updated)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_products_embedding_hnsw "
        "ON products USING hnsw (embedding vector_cosine_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_vendors_embedding_hnsw "
        "ON vendors USING hnsw (embedding vector_cosine_ops)"
    )

    # 4. GIN indexes for pg_trgm ILIKE fallback matches
    # We use gin_trgm_ops on VARCHAR/TEXT columns for fast '%search%' matches
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_products_text_search_trgm "
        "ON products USING gin (name gin_trgm_ops, description gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_vendors_text_search_trgm "
        "ON vendors USING gin (name gin_trgm_ops, description gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_vendors_text_search_trgm")
    op.execute("DROP INDEX IF EXISTS ix_products_text_search_trgm")
    op.execute("DROP INDEX IF EXISTS ix_vendors_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_products_embedding_hnsw")

    # Re-create IVFFlat indexes
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_products_embedding "
        "ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_vendors_embedding "
        "ON vendors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
