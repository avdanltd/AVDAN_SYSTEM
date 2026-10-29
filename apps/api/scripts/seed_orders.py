"""
AVDAN Orders Seed Script
=========================
Creates 15 sample orders in various states so every admin/vendor page has data.

Run AFTER seed.py:
    uv run python scripts/seed_orders.py

Idempotent — skips if orders already exist.
"""
from __future__ import annotations

import asyncio
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")

from sqlalchemy import text

from core.database import AsyncSessionLocal

NOW = datetime.now(timezone.utc)


def ts(offset_hours: int = 0) -> datetime:
    return NOW - timedelta(hours=offset_hours)


async def seed_orders() -> None:
    async with AsyncSessionLocal() as db:
        # Idempotency check
        result = await db.execute(text("SELECT COUNT(*) FROM orders"))
        count = result.scalar_one()
        if count > 0:
            print(f"✓ Orders already exist ({count} rows) — skipping.")
            return

        print("Seeding sample orders...")

        # Fetch required IDs
        customers = [
            r[0] for r in (await db.execute(
                text("SELECT id FROM users WHERE role='customer' ORDER BY created_at LIMIT 5")
            )).all()
        ]
        vendors = [
            r for r in (await db.execute(
                text("SELECT id, name FROM vendors WHERE status='active' ORDER BY created_at LIMIT 4")
            )).all()
        ]
        products_by_vendor: dict[str, list[dict]] = {}
        for vid, _ in vendors:
            rows = (await db.execute(
                text("SELECT id, name, price_kobo FROM products WHERE vendor_id=:vid LIMIT 3"),
                {"vid": str(vid)},
            )).all()
            products_by_vendor[str(vid)] = [
                {"id": str(r[0]), "name": r[1], "price": r[2]} for r in rows
            ]

        rider_id = (await db.execute(
            text("SELECT id FROM riders WHERE online=true LIMIT 1")
        )).scalar_one_or_none()

        hub_id = (await db.execute(
            text("SELECT id FROM agent_hubs LIMIT 1")
        )).scalar_one_or_none()

        if not customers or not vendors:
            print("⚠ No customers or vendors found — run seed.py first.")
            return

        delivery_address = json.dumps({
            "name": "Amaka Obi",
            "street": "14 Balogun Street",
            "city": "Lagos Island",
            "state": "Lagos",
            "phone": "+2348031234567",
        })

        # Helper to create an order + events
        async def create_order(
            customer_id: str,
            vendor_id: str,
            items: list[dict],
            final_status: str,
            created_offset_hours: int,
        ) -> str:
            oid = uuid.uuid4()
            total = sum(i["price"] * i.get("qty", 1) for i in items)
            order_items = json.dumps([
                {"product_id": i["id"], "name": i["name"],
                 "price_kobo": i["price"], "quantity": i.get("qty", 1)}
                for i in items
            ])

            created_at = NOW - timedelta(hours=created_offset_hours)

            await db.execute(text(
                "INSERT INTO orders (id, customer_id, vendor_id, status, total_kobo, "
                "delivery_address, created_at, updated_at) "
                "VALUES (:id, :cid, :vid, :status, :total, cast(:addr as jsonb), :cat, :cat)"
            ), {"id": str(oid), "cid": customer_id, "vid": vendor_id,
                "status": final_status, "total": total,
                "addr": delivery_address, "cat": created_at})

            for item in items:
                qty = item.get("qty", 1)
                await db.execute(text(
                    "INSERT INTO order_items (id, order_id, product_id, product_name, price_kobo, quantity, subtotal_kobo) "
                    "VALUES (:id, :oid, :pid, :name, :price, :qty, :subtotal)"
                ), {"id": str(uuid.uuid4()), "oid": str(oid),
                    "pid": item["id"], "name": item["name"],
                    "price": item["price"], "qty": qty,
                    "subtotal": item["price"] * qty})

            # State transition events
            transitions = _get_transitions(final_status, customer_id,
                                           str(rider_id) if rider_id else None,
                                           created_offset_hours)
            for evt in transitions:
                await db.execute(text(
                    "INSERT INTO order_events (id, order_id, from_state, to_state, "
                    "actor_id, actor_role, created_at) "
                    "VALUES (:id, :oid, :from_s, :to_s, :actor, :role, :cat)"
                ), {"id": str(uuid.uuid4()), "oid": str(oid),
                    "from_s": evt.get("from"), "to_s": evt["to"],
                    "actor": evt.get("actor"), "role": evt.get("role"),
                    "cat": evt["ts"]})

            return str(oid)

        # Orders definition: (customer_idx, vendor_idx, status, hours_ago)
        orders_to_create = [
            (0, 0, "PENDING",          1),
            (1, 0, "PENDING",          2),
            (0, 1, "PAID",             6),
            (2, 1, "PAID",             8),
            (3, 2, "PAID",             10),
            (0, 2, "VENDOR_ACCEPTED",  12),
            (1, 3, "VENDOR_ACCEPTED",  15),
            (2, 0, "PREPARING",        20),
            (3, 1, "READY_FOR_PICKUP", 28),
            (4, 2, "DELIVERED",        50),
            (0, 3, "DELIVERED",        60),
            (1, 0, "DELIVERED",        72),
            (2, 1, "DELIVERED",        80),
            (3, 2, "COMPLETED",        96),
            (4, 3, "CANCELLED",        48),
        ]

        count = 0
        for ci, vi, status, hours in orders_to_create:
            customer_id = str(customers[ci % len(customers)])
            vendor_id, vendor_name = vendors[vi % len(vendors)]
            prods = products_by_vendor.get(str(vendor_id), [])
            if not prods:
                continue
            items = prods[:2]
            await create_order(customer_id, str(vendor_id), items, status, hours)
            count += 1

        # Escrow records for PAID+ orders
        paid_orders = (await db.execute(
            text("SELECT id, total_kobo FROM orders WHERE status NOT IN ('PENDING', 'CANCELLED')")
        )).all()

        for oid, total in paid_orders:
            escrow_status = "RELEASED" if (await db.execute(
                text("SELECT status FROM orders WHERE id=:id"), {"id": str(oid)}
            )).scalar_one() == "COMPLETED" else "HELD"

            await db.execute(text(
                "INSERT INTO escrow_transactions "
                "(id, order_id, provider, provider_ref, amount_kobo, status) "
                "VALUES (:id, :oid, 'paystack', :ref, :amount, :status) "
                "ON CONFLICT DO NOTHING"
            ), {"id": str(uuid.uuid4()), "oid": str(oid),
                "ref": f"PAY-{str(oid)[:8].upper()}", "amount": total,
                "status": escrow_status})

        await db.commit()
        print(f"  ✅ {count} orders created across all states.")
        print("  ✅ Escrow records created for paid orders.")


def _get_transitions(
    final_status: str,
    customer_id: str,
    rider_id: str | None,
    base_hours: int,
) -> list[dict]:
    """Return order_events rows for the given final state."""
    sequence = [
        ("PENDING",          customer_id, "customer"),
        ("PAID",             None,        "system"),
        ("VENDOR_ACCEPTED",  None,        "vendor"),
        ("PREPARING",        None,        "vendor"),
        ("READY_FOR_PICKUP", None,        "vendor"),
        ("PICKED_UP",        rider_id,    "rider"),
        ("IN_TRANSIT_TO_HUB",rider_id,   "rider"),
        ("AT_HUB",           None,        "agent"),
        ("QA_IN_PROGRESS",   None,        "agent"),
        ("QA_PASSED",        None,        "agent"),
        ("OUT_FOR_DELIVERY", rider_id,    "rider"),
        ("DELIVERED",        rider_id,    "rider"),
        ("PAYMENT_RELEASE_PENDING", None, "system"),
        ("PAYMENT_RELEASED", None,        "system"),
        ("COMPLETED",        None,        "system"),
    ]

    special = {
        "CANCELLED": [
            {"from": None,      "to": "PENDING",   "actor": customer_id, "role": "customer",
             "ts": _offset_ts(base_hours + 0.5)},
            {"from": "PENDING", "to": "CANCELLED", "actor": customer_id, "role": "customer",
             "ts": _offset_ts(base_hours)},
        ]
    }

    if final_status in special:
        return special[final_status]

    events = []
    prev = None
    for i, (state, actor, role) in enumerate(sequence):
        h = base_hours - i * 0.5
        events.append({"from": prev, "to": state, "actor": actor, "role": role,
                        "ts": _offset_ts(max(h, 0))})
        prev = state
        if state == final_status:
            break

    return events


def _offset_ts(hours: float) -> datetime:
    return NOW - timedelta(hours=hours)


if __name__ == "__main__":
    asyncio.run(seed_orders())
