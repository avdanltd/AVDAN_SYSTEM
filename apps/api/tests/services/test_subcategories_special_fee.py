"""Sub-categories (one level), special per-unit delivery fee, and vendor/hub menu badges."""
import asyncio
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.exceptions import AppError
from services.admin.service import AdminService
from services.auth.models import User
from services.categories.schemas import CategoryCreate, CategoryUpdate
from services.categories.service import CategoryService
from services.orders.models import Order
from services.orders.service import OrderService
from services.orders.state_machine import OrderStatus
from services.vendor.models import Product, Vendor
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


def _u() -> str:
    return uuid.uuid4().hex[:8]


def test_sub_category_nesting_rules() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        svc = CategoryService(db)
        top = await svc.create(CategoryCreate(name=f"Fashion {_u()}"))
        sub = await svc.create(CategoryCreate(name=f"Shoes {_u()}", parent_id=str(top.id)))
        assert sub.parent_id == top.id

        # Only one level: a sub-category can't have children...
        with pytest.raises(AppError) as e:
            await svc.create(CategoryCreate(name=f"Sneakers {_u()}", parent_id=str(sub.id)))
        assert e.value.code == "CATEGORY_TOO_DEEP"
        # ...and a category that has children can't become one.
        other = await svc.create(CategoryCreate(name=f"Beauty {_u()}"))
        with pytest.raises(AppError) as e:
            await svc.update(str(top.id), CategoryUpdate(parent_id=str(other.id)))
        assert e.value.code == "CATEGORY_HAS_CHILDREN"
        # Empty string clears the parent.
        await svc.update(str(sub.id), CategoryUpdate(parent_id=""))
        assert sub.parent_id is None
    run(body)


def test_deactivating_a_category_hides_its_sub_categories() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        svc = CategoryService(db)
        top = await svc.create(CategoryCreate(name=f"Food {_u()}"))
        sub = await svc.create(CategoryCreate(name=f"Rice {_u()}", parent_id=str(top.id)))
        await svc.deactivate(str(top.id))
        await db.flush()
        assert top.active is False and sub.active is False
    run(body)


async def _vendor_with_products(db, *, category_ids):  # type: ignore[no-untyped-def]
    uid = _u()
    vu = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
    db.add(vu)
    await db.flush()
    vendor = Vendor(user_id=vu.id, name=f"V{uid}", slug=f"v-{uid}", status="active")
    db.add(vendor)
    await db.flush()
    products = []
    for cid in category_ids:
        p = Product(vendor_id=vendor.id, category_id=cid, name=f"P{_u()}", price_kobo=1000,
                    vendor_price_kobo=1000, approval_status="APPROVED", available=True, stock_qty=5)
        db.add(p)
        products.append(p)
    await db.flush()
    return vendor, vu, products


def test_filtering_by_a_category_includes_its_sub_categories() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cats = CategoryService(db)
        top = await cats.create(CategoryCreate(name=f"Fashion {_u()}"))
        sub = await cats.create(CategoryCreate(name=f"Shoes {_u()}", parent_id=str(top.id)))
        elsewhere = await cats.create(CategoryCreate(name=f"Tech {_u()}"))
        vendor, _vu, products = await _vendor_with_products(
            db, category_ids=[top.id, sub.id, elsewhere.id]
        )
        got, total = await VendorService(db).list_products(
            page=1, page_size=50, category_id=str(top.id), vendor_id=str(vendor.id)
        )
        assert {p.id for p in got} == {products[0].id, products[1].id} and total == 2
        # Filtering by the sub-category returns only its own products.
        got, _ = await VendorService(db).list_products(
            page=1, page_size=50, category_id=str(sub.id), vendor_id=str(vendor.id)
        )
        assert [p.id for p in got] == [products[1].id]
    run(body)


def test_admin_sets_special_delivery_fee_at_approval() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        _vendor, _vu, (p,) = await _vendor_with_products(db, category_ids=[None])
        p.approval_status = "PENDING"
        await db.flush()
        svc = AdminService(db)
        await svc.approve_product(str(p.id), 1000, special_delivery_fee_kobo=80_000)
        assert p.special_delivery_fee_kobo == 80_000
        # Leaving it out keeps the existing value; 0 clears it.
        await svc.approve_product(str(p.id), 1000)
        assert p.special_delivery_fee_kobo == 80_000
        await svc.approve_product(str(p.id), 1000, special_delivery_fee_kobo=0)
        assert p.special_delivery_fee_kobo == 0
    run(body)


def test_special_fee_is_per_unit_summed_and_added_on_top() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        _vendor, _vu, _ = await _vendor_with_products(db, category_ids=[None])
        vendor = SimpleNamespace(lat=None, lng=None)  # no coordinates → flat base fee
        svc = OrderService(db)
        plain = SimpleNamespace(special_delivery_fee_kobo=0)
        bag = SimpleNamespace(special_delivery_fee_kobo=80_000)
        crate = SimpleNamespace(special_delivery_fee_kobo=30_000)

        base = (await svc.quote_delivery(vendor, {}))["fee_kobo"]
        q = await svc.quote_delivery(vendor, {}, [(plain, 4), (bag, 3), (crate, 1)])
        assert q["special_fee_kobo"] == 3 * 80_000 + 30_000
        assert q["fee_kobo"] == base + q["special_fee_kobo"]
        # No special items: identical to the plain quote.
        assert (await svc.quote_delivery(vendor, {}, [(plain, 2)]))["fee_kobo"] == base
    run(body)


def test_vendor_and_hub_badges() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        vendor, vu, (rejected, _ok) = await _vendor_with_products(db, category_ids=[None, None])
        rejected.approval_status = "REJECTED"
        cust = User(role="customer", email=f"c{_u()}@t.io", password_hash="x", name="C", status="active")
        db.add(cust)
        await db.flush()
        for st in (OrderStatus.PAID, OrderStatus.PAID, OrderStatus.PREPARING):
            db.add(Order(customer_id=cust.id, vendor_id=vendor.id, status=st, total_kobo=1000,
                         delivery_fee_kobo=500, delivery_address={"street": "s"}))
        await db.flush()
        assert await VendorService(db).attention_counts(str(vu.id)) == {"orders": 2, "products": 1}
    run(body)
