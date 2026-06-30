"""Semantic search service — cosine similarity on pgvector embeddings.

Falls back to ilike text search when:
  - sentence-transformers is not installed
  - the query embedding cannot be generated
  - no rows have embeddings yet
"""
from __future__ import annotations

import logging

from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from services.vendor.models import Product, Vendor

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def search_products(
        self, query: str, limit: int = 20
    ) -> list[Product]:
        from services.search.embedder import encode
        from services.categories.models import Category
        from sqlalchemy.orm import selectinload

        vector = encode(query)

        if vector is not None:
            # pgvector cosine similarity — lower distance = more similar
            vec_literal = f"[{','.join(str(x) for x in vector)}]"
            sql = text(
                """
                SELECT p.id
                FROM products p
                JOIN vendors v ON p.vendor_id = v.id
                WHERE p.available = true
                  AND v.status = 'active'
                  AND p.embedding IS NOT NULL
                  AND (p.embedding <=> CAST(:embedding AS vector)) < 0.65
                ORDER BY p.embedding <=> CAST(:embedding AS vector)
                LIMIT :limit
                """
            )
            rows = await self.db.execute(sql, {"embedding": vec_literal, "limit": limit})
            ids = [r[0] for r in rows]

            if ids:
                result = await self.db.execute(
                    select(Product)
                    .where(Product.id.in_(ids))
                    .options(
                        selectinload(Product.vendor),
                        selectinload(Product.category),
                    )
                )
                products = {str(p.id): p for p in result.scalars().all()}
                # Preserve cosine similarity ordering
                return [products[str(i)] for i in ids if str(i) in products]

        # Text fallback
        return await self._text_search_products(query, limit)

    async def search_vendors(
        self, query: str, limit: int = 20
    ) -> list[Vendor]:
        from services.search.embedder import encode

        vector = encode(query)

        if vector is not None:
            vec_literal = f"[{','.join(str(x) for x in vector)}]"
            sql = text(
                """
                SELECT v.id
                FROM vendors v
                WHERE v.status = 'active'
                  AND v.embedding IS NOT NULL
                  AND (v.embedding <=> CAST(:embedding AS vector)) < 0.65
                ORDER BY v.embedding <=> CAST(:embedding AS vector)
                LIMIT :limit
                """
            )
            rows = await self.db.execute(sql, {"embedding": vec_literal, "limit": limit})
            ids = [r[0] for r in rows]

            if ids:
                result = await self.db.execute(
                    select(Vendor).where(Vendor.id.in_(ids))
                )
                vendors = {str(v.id): v for v in result.scalars().all()}
                return [vendors[str(i)] for i in ids if str(i) in vendors]

        return await self._text_search_vendors(query, limit)

    # ── Fallbacks ─────────────────────────────────────────────────────────────

    async def _text_search_products(self, query: str, limit: int) -> list[Product]:
        from sqlalchemy.orm import selectinload

        pattern = f"%{query}%"
        result = await self.db.execute(
            select(Product)
            .join(Vendor, Product.vendor_id == Vendor.id)
            .where(
                Product.available.is_(True),
                Vendor.status == "active",
                or_(Product.name.ilike(pattern), Product.description.ilike(pattern)),
            )
            .options(selectinload(Product.vendor), selectinload(Product.category))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def _text_search_vendors(self, query: str, limit: int) -> list[Vendor]:
        pattern = f"%{query}%"
        result = await self.db.execute(
            select(Vendor)
            .where(
                Vendor.status == "active",
                or_(Vendor.name.ilike(pattern), Vendor.description.ilike(pattern)),
            )
            .limit(limit)
        )
        return list(result.scalars().all())
