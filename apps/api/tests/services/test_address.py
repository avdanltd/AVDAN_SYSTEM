"""Structured address helpers — pure, no database."""
import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from core.address import (
    NIGERIA_STATES,
    StructuredAddressFields,
    apply_structured_address,
    compose_address,
)
from core.exceptions import AppError

TS_FILE = Path(__file__).resolve().parents[4] / "packages" / "types" / "src" / "nigeria-locations.ts"


def _entity(**kw):  # type: ignore[no-untyped-def]
    base = dict(address=None, street=None, city=None, state=None, lga=None, country=None, landmark=None)
    return SimpleNamespace(**{**base, **kw})


def test_state_list_matches_the_shared_typescript_list() -> None:
    text = TS_FILE.read_text()
    ts_states = re.findall(r'^  "([^"]+)": \[$', text, re.M)
    assert set(ts_states) == set(NIGERIA_STATES) and len(NIGERIA_STATES) == 37
    assert len(re.findall(r'^    "[^"]+",$', text, re.M)) == 774


def test_compose_skips_blanks_and_a_repeated_lga() -> None:
    assert compose_address("12 Adeola St", "Sango-Ota", "Ado Odo/Ota", "Ogun") == \
        "12 Adeola St, Sango-Ota, Ado Odo/Ota, Ogun"
    assert compose_address("12 Adeola St", "Ikeja", "Ikeja", "Lagos", with_country=True) == \
        "12 Adeola St, Ikeja, Lagos, Nigeria"


def test_apply_sets_fields_composes_address_and_returns_geocode_query() -> None:
    e = _entity()
    data = StructuredAddressFields(street=" 12 Adeola St ", city="Sango-Ota", state="Ogun",
                                   lga="Ado Odo/Ota", landmark="Opposite the market")
    query = apply_structured_address(e, data)
    assert e.street == "12 Adeola St" and e.country == "Nigeria"
    assert e.address == "12 Adeola St, Sango-Ota, Ado Odo/Ota, Ogun"
    assert query == "12 Adeola St, Sango-Ota, Ado Odo/Ota, Ogun, Nigeria"  # landmark never geocoded


def test_partial_update_merges_with_what_is_saved_and_nothing_sent_is_a_noop() -> None:
    e = _entity(street="1 Old Rd", city="Ikeja", state="Lagos", address="1 Old Rd, Ikeja, Lagos")
    assert apply_structured_address(e, StructuredAddressFields()) is None
    apply_structured_address(e, StructuredAddressFields(landmark="Blue gate"))
    assert e.address == "1 Old Rd, Ikeja, Lagos" and e.landmark == "Blue gate"


def test_incomplete_address_is_rejected() -> None:
    with pytest.raises(AppError) as exc:
        apply_structured_address(_entity(), StructuredAddressFields(street="12 Adeola St"))
    assert exc.value.code == "ADDRESS_INCOMPLETE" and "state" in exc.value.message


def test_unknown_state_and_other_countries_are_rejected() -> None:
    with pytest.raises(ValidationError):
        StructuredAddressFields(state="Atlantis")
    with pytest.raises(ValidationError):
        StructuredAddressFields(country="Ghana")


# ── With the database: the real vendor update path and the storefront response ──────────────

def test_vendor_profile_update_saves_structured_address_and_exposes_city_state(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    import asyncio
    import uuid
    from datetime import UTC, datetime

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from services.auth.models import User
    from services.vendor.models import Vendor
    from services.vendor.router import _public_product_response
    from services.vendor.schemas import UpdateVendorProfileRequest
    from services.vendor.service import VendorService
    from tests.conftest import TEST_DATABASE_URL

    queries: list[str] = []

    async def fake_geocode(address: str):  # type: ignore[no-untyped-def]
        queries.append(address)
        return (6.68, 3.2)

    monkeypatch.setattr("core.geocoding.geocode_address", fake_geocode)

    async def go() -> None:
        engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as db:
                uid = uuid.uuid4().hex[:8]
                user = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
                db.add(user)
                await db.flush()
                vendor = Vendor(user_id=user.id, name=f"De-Tofola {uid}", slug=f"de-{uid}", status="active")
                db.add(vendor)
                await db.flush()

                svc = VendorService(db)
                updated = await svc.update_vendor_profile(str(user.id), UpdateVendorProfileRequest(
                    street="12 Adeola St", city="Sango-Ota", state="Ogun", lga="Ado Odo/Ota",
                    landmark="Opposite the market",
                ))
                assert (updated.city, updated.state, updated.lga, updated.country) == \
                    ("Sango-Ota", "Ogun", "Ado Odo/Ota", "Nigeria")
                assert updated.address == "12 Adeola St, Sango-Ota, Ado Odo/Ota, Ogun"
                assert queries == ["12 Adeola St, Sango-Ota, Ado Odo/Ota, Ogun, Nigeria"]
                assert float(updated.lat) == 6.68

                # An older app sending only the free-text address still works.
                legacy = await svc.update_vendor_profile(str(user.id), UpdateVendorProfileRequest(address="Somewhere, Lagos"))
                assert legacy.address == "Somewhere, Lagos" and legacy.city == "Sango-Ota"

                product = SimpleNamespace(
                    id=uuid.uuid4(), vendor_id=vendor.id, vendor=vendor, category_id=None, category=None,
                    name="Power oil", description=None, price_kobo=4_900_000, compare_at_price_kobo=None,
                    special_delivery_fee_kobo=0, available=True, stock_qty=3, image_urls=[],
                    rating=0, review_count=0,
                    created_at=datetime.now(UTC),
                )
                card = _public_product_response(product)
                assert (card.vendor_city, card.vendor_state) == ("Sango-Ota", "Ogun")
                await db.rollback()
        finally:
            await engine.dispose()

    asyncio.run(go())
