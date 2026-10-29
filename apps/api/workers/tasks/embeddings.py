"""Celery tasks for generating and backfilling pgvector embeddings."""
from __future__ import annotations

import asyncio
import logging

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run(coro: object) -> object:
    """Run an async coroutine from a sync Celery task."""
    import asyncio as _asyncio
    try:
        loop = _asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
    except RuntimeError:
        loop = _asyncio.new_event_loop()
        _asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)  # type: ignore[arg-type]


@celery_app.task(name="workers.tasks.embeddings.generate_product_embedding", bind=True, max_retries=3)
def generate_product_embedding(self: object, product_id: str) -> None:  # type: ignore[misc]
    try:
        _run(_generate_product_embedding(product_id))
    except Exception as exc:
        logger.error("Embedding product %s failed: %s", product_id, exc)
        raise self.retry(exc=exc, countdown=30)  # type: ignore[attr-defined]


@celery_app.task(name="workers.tasks.embeddings.generate_vendor_embedding", bind=True, max_retries=3)
def generate_vendor_embedding(self: object, vendor_id: str) -> None:  # type: ignore[misc]
    try:
        _run(_generate_vendor_embedding(vendor_id))
    except Exception as exc:
        logger.error("Embedding vendor %s failed: %s", vendor_id, exc)
        raise self.retry(exc=exc, countdown=30)  # type: ignore[attr-defined]


@celery_app.task(name="workers.tasks.embeddings.backfill_all_embeddings")
def backfill_all_embeddings() -> dict[str, int]:
    return _run(_backfill())  # type: ignore[return-value]


# ── Async implementations ────────────────────────────────────────────────────

async def _generate_product_embedding(product_id: str) -> None:
    import services.auth.models  # noqa: F401 — registers User so Vendor mapper resolves
    import services.categories.models  # noqa: F401 — registers Category so Product mapper resolves
    from services.search.embedder import encode
    from services.vendor.models import Product
    from core.database import AsyncSessionLocal
    from sqlalchemy import select, text

    vector = None
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Product).where(Product.id == __import__("uuid").UUID(product_id))
        )
        product = result.scalar_one_or_none()
        if not product:
            return

        parts = [product.name]
        if product.description:
            parts.append(product.description)
        # Category name joined after fetch if loaded
        text_to_embed = " ".join(parts)
        vector = encode(text_to_embed)

        if vector:
            vec_str = f"[{','.join(str(x) for x in vector)}]"
            await db.execute(
                text("UPDATE products SET embedding = cast(:v as vector) WHERE id = :id"),
                {"v": vec_str, "id": product_id},
            )
            await db.commit()


async def _generate_vendor_embedding(vendor_id: str) -> None:
    import services.auth.models  # noqa: F401 — registers User so Vendor mapper resolves
    import services.categories.models  # noqa: F401 — registers Category so Product mapper resolves
    from services.search.embedder import encode
    from services.vendor.models import Vendor
    from core.database import AsyncSessionLocal
    from sqlalchemy import select, text

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Vendor).where(Vendor.id == __import__("uuid").UUID(vendor_id))
        )
        vendor = result.scalar_one_or_none()
        if not vendor:
            return

        parts = [vendor.name]
        if vendor.description:
            parts.append(vendor.description)
        vector = encode(" ".join(parts))

        if vector:
            vec_str = f"[{','.join(str(x) for x in vector)}]"
            await db.execute(
                text("UPDATE vendors SET embedding = cast(:v as vector) WHERE id = :id"),
                {"v": vec_str, "id": vendor_id},
            )
            await db.commit()


async def _backfill() -> dict[str, int]:
    import services.auth.models  # noqa: F401 — registers User so Vendor mapper resolves
    import services.categories.models  # noqa: F401 — registers Category so Product mapper resolves
    from services.vendor.models import Product, Vendor
    from core.database import AsyncSessionLocal
    from sqlalchemy import select

    product_count = 0
    vendor_count = 0

    async with AsyncSessionLocal() as db:
        product_ids = [
            str(r[0])
            for r in (await db.execute(select(Product.id))).all()
        ]
        vendor_ids = [
            str(r[0])
            for r in (await db.execute(select(Vendor.id))).all()
        ]

    for pid in product_ids:
        await _generate_product_embedding(pid)
        product_count += 1

    for vid in vendor_ids:
        await _generate_vendor_embedding(vid)
        vendor_count += 1

    logger.info("Backfill complete: %d products, %d vendors", product_count, vendor_count)
    return {"products": product_count, "vendors": vendor_count}
