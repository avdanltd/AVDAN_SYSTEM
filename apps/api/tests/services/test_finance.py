"""Financial tracker: earned = payment released; paid-but-not-released is shown separately."""
import asyncio
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.exceptions import ValidationException
from services.admin.finance import FinanceService
from services.auth.models import User
from services.dispatch.models import Rider
from services.orders.models import Order, OrderEvent
from services.vendor.models import Vendor
from tests.conftest import TEST_DATABASE_URL

# A window nothing else in the test database touches.
D1 = datetime(2031, 3, 1, 9, tzinfo=UTC)
D2 = datetime(2031, 3, 1, 15, tzinfo=UTC)
START = datetime(2031, 3, 1, tzinfo=UTC)
END = datetime(2031, 3, 2, tzinfo=UTC)


def run(coro_fn):  # type: ignore[no-untyped-def]
    async def _go():  # type: ignore[no-untyped-def]
        engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                await coro_fn(db)
                await db.rollback()
        finally:
            await engine.dispose()
    asyncio.run(_go())


def _u() -> str:
    return uuid.uuid4().hex[:8]


async def _world(db):  # type: ignore[no-untyped-def]
    uid = _u()
    cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="Cust", status="active")
    vu = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
    ru = User(role="rider", email=f"r{uid}@t.io", password_hash="x", name="Rider", status="active")
    db.add_all([cust, vu, ru])
    await db.flush()
    vendor = Vendor(user_id=vu.id, name=f"Shop{uid}", slug=f"s-{uid}", status="active")
    rider = Rider(user_id=ru.id)
    db.add_all([vendor, rider])
    await db.flush()
    return cust, vu, ru, vendor, rider


async def _order(db, cust, vendor, rider, status, events):  # type: ignore[no-untyped-def]
    o = Order(
        customer_id=cust.id, vendor_id=vendor.id, rider_id=rider.id, status=status,
        total_kobo=285_000, vendor_total_kobo=270_000, delivery_fee_kobo=87_440, rider_fee_kobo=69_952,
        delivery_address={"street": "s"},
    )
    db.add(o)
    await db.flush()
    for state, when in events:
        db.add(OrderEvent(order_id=o.id, to_state=state, actor_role="system", created_at=when))
    await db.flush()
    return o


def test_released_pending_and_spent_reconcile() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, vu, ru, vendor, rider = await _world(db)
        await _order(db, cust, vendor, rider, "COMPLETED", [("PAID", D1), ("PAYMENT_RELEASED", D2)])
        await _order(db, cust, vendor, rider, "PREPARING", [("PAID", D1)])  # paid, not released
        await _order(db, cust, vendor, rider, "CANCELLED", [("PAID", D1)])  # refunded: counts nowhere
        svc = FinanceService(db)

        s = await svc.summary(START, END)
        r, p = s["released"], s["pending"]
        assert r["orders"] == 1 and p["orders"] == 1
        assert r["customer_paid_kobo"] == 285_000 + 87_440
        assert r["vendors_kobo"] == 270_000 and r["riders_kobo"] == 69_952
        assert r["avdan_product_kobo"] == 15_000 and r["avdan_delivery_kobo"] == 17_488
        # Everything the customer paid is accounted for.
        assert r["customer_paid_kobo"] == r["vendors_kobo"] + r["riders_kobo"] + r["avdan_total_kobo"]
        assert p["customer_paid_kobo"] == 372_440

        vendors = await svc.people("vendor", START, END)
        row = next(x for x in vendors if x["user_id"] == str(vu.id))
        assert (row["earned_kobo"], row["pending_kobo"], row["orders"]) == (270_000, 270_000, 1)
        riders = await svc.people("rider", START, END)
        assert next(x for x in riders if x["user_id"] == str(ru.id))["earned_kobo"] == 69_952

        customers = await svc.people("customer", START, END)
        c = next(x for x in customers if x["user_id"] == str(cust.id))
        assert c["spent_kobo"] == 2 * 372_440 and c["pending_kobo"] == 372_440 and c["orders"] == 2

        detail = await svc.person("vendor", str(vu.id), START, END)
        assert detail["released_kobo"] == 270_000 and detail["pending_kobo"] == 270_000
        assert {ln["state"] for ln in detail["order_lines"]} == {"released", "pending"}

        waiting = await svc.pending_orders(START, END)
        assert waiting["totals"]["orders"] == 1 and waiting["orders"][0]["status"] == "PREPARING"
    run(body)


def test_period_and_search_are_respected() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, vu, _ru, vendor, rider = await _world(db)
        await _order(db, cust, vendor, rider, "COMPLETED", [("PAID", D1), ("PAYMENT_RELEASED", D2)])
        svc = FinanceService(db)
        # The day after: released_at falls outside, so nothing is earned.
        later = await svc.summary(datetime(2031, 3, 2, tzinfo=UTC), datetime(2031, 3, 3, tzinfo=UTC))
        assert later["released"]["orders"] == 0
        assert await svc.people("vendor", START, END, search="no-such-shop") == []
        assert len(await svc.people("vendor", START, END, search=vendor.name[:6])) == 1
        with pytest.raises(ValidationException):
            await svc.summary(END, START)
    run(body)
