"""A hub agent fills in their own hub's address, description and map position."""
import asyncio
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from services.auth.models import User
from services.qa.models import AgentHub
from services.qa.schemas import UpdateMyHubRequest
from services.qa.service import QAService
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


async def _agent(db):  # type: ignore[no-untyped-def]
    hub = AgentHub(name=f"Hub {uuid.uuid4().hex[:6]}", capacity=50)
    db.add(hub)
    await db.flush()
    user = User(role="agent", email=f"{uuid.uuid4().hex[:8]}@t.io", password_hash="x",
                name="Agent", status="active", hub_id=hub.id)
    db.add(user)
    await db.flush()
    return SimpleNamespace(hub=hub, user=user)


def test_agent_sets_coordinates_and_description() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _agent(db)
        hub = await QAService(db).update_my_hub(
            str(s.user.id),
            UpdateMyHubRequest(address="12 Allen Ave, Ikeja", description="Blue gate, beside the pharmacy",
                               lat=6.6018, lng=3.3515),
        )
        assert (float(hub.lat), float(hub.lng)) == (6.6018, 3.3515)
        assert hub.address == "12 Allen Ave, Ikeja"
        assert hub.description == "Blue gate, beside the pharmacy"
    run(body)


def test_address_alone_is_geocoded(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    async def fake(_address):  # type: ignore[no-untyped-def]
        return 6.5, 3.3
    monkeypatch.setattr("core.geocoding.geocode_address", fake)

    async def body(db):  # type: ignore[no-untyped-def]
        s = await _agent(db)
        hub = await QAService(db).update_my_hub(str(s.user.id), UpdateMyHubRequest(address="Somewhere, Lagos"))
        assert (float(hub.lat), float(hub.lng)) == (6.5, 3.3)
    run(body)


def test_description_only_keeps_position() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _agent(db)
        svc = QAService(db)
        await svc.update_my_hub(str(s.user.id), UpdateMyHubRequest(lat=6.6, lng=3.4))
        hub = await svc.update_my_hub(str(s.user.id), UpdateMyHubRequest(description="Ask for Tunde"))
        assert (float(hub.lat), float(hub.lng)) == (6.6, 3.4)
        assert hub.description == "Ask for Tunde"
    run(body)
