"""A vendor can switch their store off; a closed store cannot take new orders."""
import asyncio
import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.exceptions import ValidationException
from services.auth.models import User
from services.orders.schemas import CreateOrderRequest, DeliveryAddress, OrderItemRequest
from services.orders.service import OrderService
from services.vendor.models import Vendor
from services.vendor.service import VendorService
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


async def _vendor(db):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    user = User(role="vendor", email=f"{uid}@t.io", password_hash="x", name="V", status="active")
    db.add(user)
    await db.flush()
    vendor = Vendor(user_id=user.id, name=f"Shop{uid}", slug=f"s-{uid}", status="active")
    db.add(vendor)
    await db.flush()
    return user, vendor


def test_new_store_is_open_and_can_be_switched() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        user, vendor = await _vendor(db)
        assert vendor.is_open is True
        closed = await VendorService(db).set_store_open(str(user.id), False)
        assert closed.is_open is False
        reopened = await VendorService(db).set_store_open(str(user.id), True)
        assert reopened.is_open is True
    run(body)


def test_closed_store_rejects_new_orders() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        user, vendor = await _vendor(db)
        await VendorService(db).set_store_open(str(user.id), False)
        data = CreateOrderRequest(
            vendor_id=str(vendor.id),
            items=[OrderItemRequest(product_id=str(uuid.uuid4()), quantity=1)],
            delivery_address=DeliveryAddress(street="1 Road", city="Ikeja", state="Lagos"),
        )
        with pytest.raises(ValidationException, match="closed"):
            await OrderService(db).create_order(str(uuid.uuid4()), data)
    run(body)


def test_pending_delivery_codes_only_for_own_out_for_delivery_orders() -> None:
    from services.orders.models import Order

    async def body(db):  # type: ignore[no-untyped-def]
        _, vendor = await _vendor(db)
        uid = uuid.uuid4().hex[:8]
        mine = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="C", status="active")
        other = User(role="customer", email=f"o{uid}@t.io", password_hash="x", name="O", status="active")
        db.add_all([mine, other])
        await db.flush()

        def order(owner, status, code):  # type: ignore[no-untyped-def]
            return Order(
                customer_id=owner.id, vendor_id=vendor.id, status=status, total_kobo=1000,
                delivery_fee_kobo=0, delivery_address={"street": "1", "city": "x", "state": "y"},
                delivery_code=code,
            )

        db.add_all([
            order(mine, "OUT_FOR_DELIVERY", "1234"),
            order(mine, "DELIVERED", "5678"),
            order(other, "OUT_FOR_DELIVERY", "9999"),
        ])
        await db.flush()
        found = await OrderService(db).list_pending_delivery_codes(str(mine.id))
        assert [o.delivery_code for o in found] == ["1234"]
    run(body)
