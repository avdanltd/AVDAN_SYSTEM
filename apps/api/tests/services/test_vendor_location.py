"""A vendor can set their map position directly; it wins over geocoding the address."""
import asyncio
import uuid

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from services.auth.models import User
from services.vendor.models import Vendor
from services.vendor.schemas import UpdateVendorProfileRequest
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
    vendor = Vendor(user_id=user.id, name=f"V{uid}", slug=f"v-{uid}", status="active")
    db.add(vendor)
    await db.flush()
    return user, vendor


def test_explicit_coordinates_are_saved_without_geocoding(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    async def boom(_a):  # type: ignore[no-untyped-def]
        raise AssertionError("must not geocode when coordinates are sent")
    monkeypatch.setattr("core.geocoding.geocode_address", boom)

    async def body(db):  # type: ignore[no-untyped-def]
        user, _ = await _vendor(db)
        v = await VendorService(db).update_vendor_profile(
            str(user.id), UpdateVendorProfileRequest(address="Ikeja", lat=6.6, lng=3.35)
        )
        assert (float(v.lat), float(v.lng)) == (6.6, 3.35)
        assert v.address == "Ikeja"
    run(body)


def test_failed_geocode_keeps_existing_position(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    async def none(_a):  # type: ignore[no-untyped-def]
        return None
    monkeypatch.setattr("core.geocoding.geocode_address", none)

    async def body(db):  # type: ignore[no-untyped-def]
        user, vendor = await _vendor(db)
        vendor.lat, vendor.lng = 6.5, 3.3
        v = await VendorService(db).update_vendor_profile(
            str(user.id), UpdateVendorProfileRequest(address="Unfindable place")
        )
        assert (float(v.lat), float(v.lng)) == (6.5, 3.3)
    run(body)
