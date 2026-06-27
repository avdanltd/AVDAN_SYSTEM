"""
Backfill pgvector embeddings for all products and vendors.

Run after seed.py with the Celery worker running:
    uv run python scripts/backfill_embeddings.py

This runs synchronously (blocking) — it's a one-shot script.
"""
from __future__ import annotations

import asyncio
import sys

sys.path.insert(0, ".")

from workers.tasks.embeddings import _backfill


async def main() -> None:
    print("Backfilling embeddings for all products and vendors...")
    result = await _backfill()
    print(f"✅ Done — {result['products']} products, {result['vendors']} vendors embedded.")


if __name__ == "__main__":
    asyncio.run(main())
