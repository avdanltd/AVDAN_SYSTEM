# Production data sync — seeds and corrections

Everything run against the local database that production also needs, in order. Run every
command on the VPS (`ssh` in first). All of them are safe to re-run.

```bash
cd /opt/avdan
DC="docker compose -f /opt/avdan/docker-compose.prod.yml"
```

> The scripts ship inside the `api` image (`COPY apps/api/ ./`), so `sync_seed_data.py` only
> exists on the server **after the commit that adds it has been deployed**.

---

## 0. Back up first

```bash
$DC exec db-backup /usr/local/bin/backup-db.sh
$DC exec db-backup ls -lh /backups | tail -3     # confirm a new dump with today's timestamp
```

## 1. See what state production is in

```bash
$DC run --rm api uv run python -c "
import asyncio
from sqlalchemy import text
from core.database import AsyncSessionLocal
async def main():
    async with AsyncSessionLocal() as db:
        for t in ['users','vendors','products','agent_hubs','riders','orders','categories']:
            n = (await db.execute(text(f'SELECT COUNT(*) FROM {t}'))).scalar_one()
            print(f'{t:12} {n}')
        v = (await db.execute(text('SELECT version_num FROM alembic_version'))).scalar_one()
        print('alembic     ', v)
asyncio.run(main())
"
```

- **`users` is 0 (a fresh database):** run step 2, then go to step 4. Step 3 has nothing to fix
  on a fresh seed.
- **`users` > 0 (seeded earlier):** skip step 2 and run step 3.

For reference, the local database has 21 users, 8 categories, 8 vendors and 78 products, and is
on the latest migration.

## 2. Seed (fresh database only)

```bash
$DC run --rm api uv run python scripts/seed.py
```

This does nothing if `admin@avdan.com` already exists. **Every seeded account uses the password
`Avdan@2024`**, so change the admin's password straight away on a public production system.

`scripts/seed_orders.py` creates 15 **fake demo orders**. Don't run it on production unless you
want demo data there. (It also does nothing if any order exists.)

## 3. Apply the seed-data corrections (database seeded before the fixes)

```bash
$DC run --rm api uv run python scripts/sync_seed_data.py --dry-run   # read the list first
$DC run --rm api uv run python scripts/sync_seed_data.py             # then apply
```

This fills in what was fixed in `seed.py` after production was first seeded:

| Fix | Effect if skipped |
|---|---|
| Seed account names | Blank names across admin, vendor and rider screens |
| `hub1`/`hub2` linked to their hub (`users.hub_id`) | Hub agents have no hub to act for in the hub portal |
| Hubs moved off the shared placeholder point (6.5244, 3.3792) | Nearest-hub dispatch can't tell the two hubs apart |
| Vendor addresses and coordinates | Rider sees no pickup address; dispatch falls back to zone matching |
| Product images and vendor logos (about 40% were broken) | Broken or wrong product photos |

It only fills **empty** fields, and only moves hubs that are still on the placeholder, so nothing
an admin or vendor entered gets overwritten. The dry run doesn't check images; the apply run
syncs them and lists any seed product it couldn't find.

## 4. Coordinates for vendors who typed their own address

```bash
$DC run --rm api uv run python scripts/backfill_coordinates.py
```

This only touches vendors that have an address but no coordinates. It uses the free geocoding
service at 1 request per second, which takes a few seconds.

## 5. Search embeddings

```bash
$DC run --rm api uv run python scripts/backfill_embeddings.py
```

This builds the vectors product search uses. Run it after 2 or 3. On a new database, search
returns nothing until this has run.

## 6. Restart workers so they pick up the data

```bash
$DC restart api celery celery-beat
```

---

## Deliberately NOT copied from local

- **Vendor and rider payout accounts (Paystack recipient codes).** Each vendor saves their own
  in the app (Settings → Payout account). Codes belong to one Paystack account and one mode, and
  every code breaks when production switches to `sk_live_`. The local `RCP_test_local` value was
  fake data and was never in production.
- **Local test orders and escrow rows.**
- **The ad-hoc delete of `netojaycee@gmail.com` / `edehjaycee@gmail.com`** in `docs/note.txt`.
  That was a one-time cleanup, not a standing fix.
- **Platform config** (commission, delivery fee, escrow window). It needs no seed; defaults apply
  until an admin saves Settings.

## Verify

- **Admin → Riders / Hubs:** names show, and each hub has its own location.
- **Log in as `hub1@avdan.com` in the hub portal:** the hub dashboard loads.
- **Customer app:** product images load and search returns results.
- **Rider app, on an assigned order:** the vendor's pickup address shows.
