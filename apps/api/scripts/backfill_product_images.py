"""
One-off: sync product/vendor-logo image URLs from the corrected VENDOR_PRODUCTS dict in
scripts/seed.py into an already-seeded database.

Why this exists: seed.py's product image IDs were audited this session and ~40% were found
broken (404) or topically wrong (e.g. a human portrait used for a "JAMB CBT Practice Card").
Fixing seed.py only helps a *future* re-seed — this backfills the fix into a database that was
already seeded before the fix, matching rows by (vendor name, product name) / vendor name alone
for logos, which are stable identifiers here.

Safe to run repeatedly. Only touches rows matching a name already in VENDOR_PRODUCTS/USERS —
does nothing to any product/vendor added outside this seed data.

Run:
    uv run python scripts/backfill_product_images.py
"""
from __future__ import annotations

import asyncio
import sys

sys.path.insert(0, ".")

from sqlalchemy import select

from core.database import AsyncSessionLocal, engine

# Vendor/Product relationships reach User, Category, etc. by class name — SQLAlchemy resolves
# those lazily and fails with "expression 'X' failed to locate a name" unless every related
# model module has been imported somewhere in the process first (same fix as
# workers/celery_app.py and backfill_coordinates.py).
import services.auth.models  # noqa: F401
import services.categories.models  # noqa: F401
import services.orders.models  # noqa: F401
import services.payment.models  # noqa: F401
from scripts.seed import VENDOR_PRODUCTS
from services.vendor.models import Product, Vendor


async def main() -> None:
    async with AsyncSessionLocal() as db:
        updated_products = 0
        updated_logos = 0
        missing = []

        for business_name, data in VENDOR_PRODUCTS.items():
            vendor_result = await db.execute(select(Vendor).where(Vendor.name == business_name))
            vendor = vendor_result.scalar_one_or_none()
            if not vendor:
                missing.append(f"vendor '{business_name}'")
                continue

            if vendor.logo_url != data["logo_url"]:
                vendor.logo_url = data["logo_url"]
                updated_logos += 1

            products_result = await db.execute(select(Product).where(Product.vendor_id == vendor.id))
            products_by_name = {p.name: p for p in products_result.scalars().all()}

            for item in data["products"]:
                product = products_by_name.get(item["name"])
                if not product:
                    missing.append(f"product '{item['name']}' ({business_name})")
                    continue
                if product.image_urls != item["imgs"]:
                    product.image_urls = item["imgs"]
                    updated_products += 1

        await db.commit()
        print(f"Updated {updated_products} product images, {updated_logos} vendor logos.")
        if missing:
            print(f"\n{len(missing)} name(s) in seed data had no matching DB row (skipped):")
            for m in missing:
                print(f"  - {m}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
