"""
Bring an ALREADY-SEEDED database up to date with the current seed data in scripts/seed.py.

Why this exists: seed.py is all-or-nothing — it skips entirely once admin@avdan.com exists. So
every correction made to the seed data after a database was first seeded (production included)
never reaches that database by re-running seed.py. This applies those corrections in place:

  1. users.name        — seed accounts created before seed.py set names (2026-08-31)
  2. users.hub_id      — hub1/hub2 agents linked to their hub (2026-08-31); without it the hub
                         portal has no hub to act for
  3. agent_hubs lat/lng — both hubs were seeded at the same point (6.5244, 3.3792), which made
                         nearest-hub dispatch meaningless; moved to their real distinct locations
  4. vendors address/lat/lng — vendors were seeded with no location at all (2026-09-18), so
                         proximity dispatch fell back to zone matching for every vendor
  5. product images / vendor logos — ~40% of the original image URLs were broken or wrong
                         (delegates to backfill_product_images.py)

Never overwrites real data: names, hub links and vendor locations are only filled where EMPTY,
and hub coordinates only move if they still hold the old shared placeholder. Only rows matching
the seed accounts/businesses by email/name are touched. Safe to run repeatedly.

Run (from apps/api, or inside the api container — see RUNBOOK_PROD_DATA_SYNC.md):
    uv run python scripts/sync_seed_data.py --dry-run   # report what would change, change nothing
    uv run python scripts/sync_seed_data.py             # apply
"""
from __future__ import annotations

import argparse
import asyncio
import sys

sys.path.insert(0, ".")

from sqlalchemy import text

from core.database import AsyncSessionLocal, engine
from scripts.seed import USERS, VENDOR_LOCATIONS

# Keep in step with the `hubs` list in seed.py's seed() (it's a local variable there).
HUBS = [
    ("Hub Central Lagos", "hub1@avdan.com", 6.6018, 3.3515),
    ("Hub Lekki", "hub2@avdan.com", 6.4698, 3.5852),
]
OLD_SHARED_HUB_POINT = (6.5244, 3.3792)


async def sync(dry_run: bool) -> None:
    changes: list[str] = []
    warnings: list[str] = []

    async with AsyncSessionLocal() as db:
        # 1. Names on seed accounts that have none.
        for u in USERS:
            res = await db.execute(
                text(
                    "UPDATE users SET name = :name WHERE email = :email "
                    "AND (name IS NULL OR name = '') RETURNING email"
                ),
                {"name": u["name"], "email": u["email"]},
            )
            if res.first():
                changes.append(f"name  {u['email']} -> {u['name']}")

        # 2 + 3. Hubs: link agents, fix placeholder coordinates.
        for hub_name, email, lat, lng in HUBS:
            hub = (
                await db.execute(
                    text("SELECT id, lat, lng FROM agent_hubs WHERE name = :n"), {"n": hub_name}
                )
            ).first()
            if not hub:
                warnings.append(f"hub '{hub_name}' not found — skipped hub link/coords for {email}")
                continue

            res = await db.execute(
                text(
                    "UPDATE users SET hub_id = :hid WHERE email = :email AND role = 'agent' "
                    "AND hub_id IS NULL RETURNING email"
                ),
                {"hid": hub.id, "email": email},
            )
            if res.first():
                changes.append(f"hub   {email} linked to '{hub_name}'")

            stuck_on_placeholder = hub.lat is None or hub.lng is None or (
                round(float(hub.lat), 4), round(float(hub.lng), 4)
            ) == OLD_SHARED_HUB_POINT
            if stuck_on_placeholder:
                await db.execute(
                    text("UPDATE agent_hubs SET lat = :lat, lng = :lng WHERE id = :id"),
                    {"lat": lat, "lng": lng, "id": hub.id},
                )
                changes.append(f"hub   '{hub_name}' coords {hub.lat},{hub.lng} -> {lat},{lng}")

        # 4. Vendor locations where missing.
        for business, (addr, lat, lng) in VENDOR_LOCATIONS.items():
            vendor = (
                await db.execute(
                    text("SELECT id, address, lat, lng FROM vendors WHERE name = :n"), {"n": business}
                )
            ).first()
            if not vendor:
                warnings.append(f"vendor '{business}' not found — skipped location")
                continue
            if not vendor.address:
                await db.execute(
                    text("UPDATE vendors SET address = :a, lat = :lat, lng = :lng WHERE id = :id"),
                    {"a": addr, "lat": lat, "lng": lng, "id": vendor.id},
                )
                changes.append(f"vendor '{business}' location -> {addr}")
            elif vendor.lat is None or vendor.lng is None:
                # The vendor set their own address — keep it; backfill_coordinates.py geocodes it.
                warnings.append(
                    f"vendor '{business}' has its own address but no coordinates — "
                    "run scripts/backfill_coordinates.py"
                )

        if dry_run:
            await db.rollback()
        else:
            await db.commit()

    print(("DRY RUN — nothing written. Would change:" if dry_run else "Applied:") if changes else
          "Users, hubs and vendor locations already up to date.")
    for c in changes:
        print(f"  {c}")
    for w in warnings:
        print(f"  ! {w}")

    # 5. Images — separate script, own transaction; it has no dry-run, so skip it on one.
    if dry_run:
        print("\n(Product images/logos: not checked in --dry-run; the apply run syncs them.)")
    else:
        print("\nSyncing product images and vendor logos...")
        from scripts.backfill_product_images import main as backfill_images

        await backfill_images()  # disposes the engine itself
        return

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="report changes, write nothing")
    asyncio.run(sync(parser.parse_args().dry_run))
