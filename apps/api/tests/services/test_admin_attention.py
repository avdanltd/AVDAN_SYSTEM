"""Admin menu badges: counts of items waiting on a person."""
import asyncio
import uuid

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from services.admin.service import AdminService
from services.auth.models import User
from services.orders.models import Order
from services.orders.state_machine import OrderStatus
from services.vendor.models import Vendor
from tests.conftest import TEST_DATABASE_URL


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


def test_attention_counts_rise_with_waiting_work() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        svc = AdminService(db)
        before = await svc.attention_counts()

        uid = uuid.uuid4().hex[:8]
        cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="C", status="active")
        vu = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
        db.add_all([cust, vu])
        await db.flush()
        vendor = Vendor(user_id=vu.id, name=f"V{uid}", slug=f"v-{uid}", status="pending")
        db.add(vendor)
        await db.flush()
        db.add(Order(customer_id=cust.id, vendor_id=vendor.id, status=OrderStatus.READY_FOR_PICKUP,
                     total_kobo=1000, delivery_fee_kobo=500, delivery_address={"street": "s"}))
        await db.flush()

        after = await svc.attention_counts()
        assert after["vendors"] == before["vendors"] + 1
        assert after["dispatch"] == before["dispatch"] + 1
        assert set(after) == {"products", "vendors", "payouts", "disputes", "dispatch"}
    run(body)
