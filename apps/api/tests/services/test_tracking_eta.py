"""
Stage-aware ETA and the hub incoming board.

Requires: postgres on localhost:5432 (avdan_test db).
Run: uv run pytest tests/services/test_tracking_eta.py -v
"""
import json
import uuid
from datetime import UTC, datetime

from services.auth.models import User
from services.dispatch.models import Rider
from services.dispatch.service import eta_for, load_eta_context
from services.orders.models import Order
from services.orders.state_machine import OrderStatus
from services.qa.models import AgentHub
from services.qa.service import QAService
from services.vendor.models import Vendor
from tests.services.test_wallet import run

# ~11.1 km per 0.1° of latitude; at road_factor 1.3 and 25 km/h that is ~34 min per 0.5°.
CTX = {
    "status": OrderStatus.OUT_FOR_DELIVERY,
    "speed_kmh": 25.0,
    "road_factor": 1.3,
    "destinations": {"to_vendor": (6.5, 3.3), "to_hub": (6.6, 3.3), "to_customer": (6.8, 3.3)},
}


def test_eta_follows_the_stage() -> None:
    # Heading to the customer: 0.2° ≈ 22.2 km × 1.3 = 28.9 km at 25 km/h ≈ 69 min.
    stage, eta = eta_for(CTX, 6.6, 3.3)
    assert stage == "to_customer" and eta is not None and 66 * 60 < eta < 72 * 60

    # Same rider position, but before pickup the destination is the vendor, not the customer.
    stage, eta = eta_for({**CTX, "status": OrderStatus.READY_FOR_PICKUP}, 6.6, 3.3)
    assert stage == "to_vendor" and eta is not None and eta < 36 * 60

    stage, _ = eta_for({**CTX, "status": OrderStatus.PICKED_UP}, 6.6, 3.3)
    assert stage == "to_hub"


def test_no_eta_when_rider_is_not_travelling_or_destination_unknown() -> None:
    assert eta_for({**CTX, "status": OrderStatus.QA_IN_PROGRESS}, 6.6, 3.3) == ("at_hub", None)
    no_coords = {**CTX, "destinations": {**CTX["destinations"], "to_customer": None}}
    assert eta_for(no_coords, 6.6, 3.3) == ("to_customer", None)


class FakeRedis:
    def __init__(self, data: dict[str, str]) -> None:
        self.data = data

    async def get(self, key: str) -> str | None:
        return self.data.get(key)


def test_hub_incoming_board_sorts_by_eta_and_tolerates_missing_gps() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        uid = uuid.uuid4().hex[:8]
        hub = AgentHub(name=f"Hub {uid}", lat=6.6, lng=3.3, capacity=50, active=True)
        agent = User(role="agent", email=f"ag{uid}@t.io", password_hash="x", name="Agent", status="active")
        cust = User(role="customer", email=f"cu{uid}@t.io", password_hash="x", name="C", status="active")
        db.add_all([hub, agent, cust])
        await db.flush()
        agent.hub_id = hub.id
        vuser = User(role="vendor", email=f"ve{uid}@t.io", password_hash="x", name="V", status="active")
        db.add(vuser)
        await db.flush()
        vendor = Vendor(user_id=vuser.id, name=f"V{uid}", slug=f"v-{uid}", status="active", lat=6.5, lng=3.3)
        db.add(vendor)
        await db.flush()

        riders = {}
        for label in ("near", "far", "nogps"):
            ru = User(role="rider", email=f"{label}{uid}@t.io", password_hash="x", name=label,
                      phone=f"+234{uuid.uuid4().int % 10**10:010d}", status="active")
            db.add(ru)
            await db.flush()
            r = Rider(user_id=ru.id)
            db.add(r)
            await db.flush()
            riders[label] = r
            db.add(Order(customer_id=cust.id, vendor_id=vendor.id, rider_id=r.id, hub_id=hub.id,
                         status=OrderStatus.IN_TRANSIT_TO_HUB, total_kobo=1000, delivery_address={"street": "s"}))
        await db.flush()

        now = datetime.now(UTC).isoformat()
        redis = FakeRedis({
            f"rider:location:{riders['near'].id}": json.dumps({"lat": 6.59, "lng": 3.3, "updated_at": now}),
            f"rider:location:{riders['far'].id}": json.dumps({"lat": 6.5, "lng": 3.3, "updated_at": now}),
        })
        rows = await QAService(db).list_incoming(str(agent.id), redis)

        assert [r["rider_name"] for r in rows] == ["near", "far", "nogps"]
        assert rows[0]["stage"] == "to_hub" and rows[0]["eta_seconds"] < rows[1]["eta_seconds"]
        assert rows[2]["eta_seconds"] is None and rows[2]["rider_phone"]  # still callable
    run(body)


def test_context_loads_destinations_for_each_stage() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        uid = uuid.uuid4().hex[:8]
        hub = AgentHub(name=f"H{uid}", lat=6.6, lng=3.3, capacity=5, active=True)
        cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="C", status="active")
        vuser = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
        db.add_all([hub, cust, vuser])
        await db.flush()
        vendor = Vendor(user_id=vuser.id, name=f"V{uid}", slug=f"v-{uid}", status="active", lat=6.5, lng=3.3)
        db.add(vendor)
        await db.flush()
        order = Order(customer_id=cust.id, vendor_id=vendor.id, hub_id=hub.id, status=OrderStatus.PICKED_UP,
                      total_kobo=1, delivery_address={"lat": 6.8, "lng": 3.3})
        db.add(order)
        await db.flush()
        ctx = await load_eta_context(db, order)
        assert ctx["destinations"]["to_vendor"] == (6.5, 3.3)
        assert ctx["destinations"]["to_hub"] == (6.6, 3.3)
        assert ctx["destinations"]["to_customer"] == (6.8, 3.3)
        assert ctx["speed_kmh"] == 25.0 and ctx["road_factor"] == 1.3
    run(body)
