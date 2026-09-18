"""
Backfill lat/lng for vendors that have an address on file but no coordinates yet.

Why this is needed: geocoding only runs when a vendor sets/updates their address through the
Settings UI (services/vendor/service.py). A vendor who set their address before that wiring
existed, or whose geocode call failed transiently at the time, is left with an address string
and no coordinates — which silently degrades proximity-based hub/rider dispatch
(DispatchService._pick_hub, _nearest_by_distance) to zone-based fallback matching for that
vendor. This is a one-shot catch-up for those rows; ordinary onboarding does not need it.

Safe to run repeatedly and safe to run against production — it only touches vendors matching
`address IS NOT NULL AND (lat IS NULL OR lng IS NULL)`, and does nothing if none exist.

Respects Nominatim's 1 req/sec fair-use policy (core/geocoding.py) with a 1.1s pause between
calls — for a handful of stragglers this is a few seconds; it is not meant for bulk geocoding.

Run:
    uv run python scripts/backfill_coordinates.py
"""
from __future__ import annotations

import asyncio
import sys

sys.path.insert(0, ".")

from sqlalchemy import select

from core.database import AsyncSessionLocal, engine
from core.geocoding import geocode_address

# Vendor's relationships reach User, Category, etc. by class name — SQLAlchemy resolves those
# lazily and fails with "expression 'X' failed to locate a name" unless every related model
# module has been imported somewhere in the process first. Same fix workers/celery_app.py uses.
import services.auth.models  # noqa: F401
import services.categories.models  # noqa: F401
import services.orders.models  # noqa: F401
import services.payment.models  # noqa: F401
from services.vendor.models import Vendor


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Vendor).where(
                Vendor.address.isnot(None),
                Vendor.address != "",
                (Vendor.lat.is_(None)) | (Vendor.lng.is_(None)),
            )
        )
        vendors = list(result.scalars().all())

        if not vendors:
            print("Nothing to backfill — every vendor with an address already has coordinates.")
            return

        print(f"Backfilling coordinates for {len(vendors)} vendor(s)...")
        geocoded, failed = 0, 0
        for i, vendor in enumerate(vendors):
            coords = await geocode_address(vendor.address)
            if coords is None:
                print(f"  ✗ {vendor.name!r} — could not geocode {vendor.address!r}")
                failed += 1
            else:
                vendor.lat, vendor.lng = coords
                print(f"  ✓ {vendor.name!r} — {coords[0]:.6f}, {coords[1]:.6f}")
                geocoded += 1
            if i < len(vendors) - 1:
                await asyncio.sleep(1.1)  # Nominatim fair-use: max 1 req/sec

        await db.commit()
        print(f"\n✅ Done — {geocoded} geocoded, {failed} failed (left for a later retry).")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
