import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from collections.abc import AsyncGenerator

import pytest
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from starlette.testclient import TestClient

import services.auth.models  # noqa: F401 — registers models with Base.metadata
from core.database import get_db
from core.redis import get_redis
from main import create_app
from models.base import Base

TEST_DATABASE_URL = "postgresql+asyncpg://avdan:avdan_dev@localhost:5432/avdan_test"
TEST_REDIS_URL = "redis://localhost:6379/15"


@pytest.fixture(scope="session", autouse=True)
def setup_database() -> None:
    """
    Drops and recreates all tables once for the test session.
    Uses asyncio.run() — owns its own isolated event loop.
    """
    async def _run() -> None:
        engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(_run())


@pytest.fixture
def client() -> TestClient:
    """
    Synchronous test client backed by Starlette's TestClient.
    TestClient manages its own event loop for the duration of the `with` block,
    so asyncpg connections created per-request live in a stable, consistent loop.
    NullPool means every request gets a fresh DB connection — no stale state.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    redis_pool = aioredis.ConnectionPool.from_url(TEST_REDIS_URL, decode_responses=True)

    app = create_app()

    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def _get_test_redis() -> AsyncGenerator[aioredis.Redis, None]:  # type: ignore[type-arg]
        r: aioredis.Redis = aioredis.Redis(connection_pool=redis_pool)  # type: ignore[type-arg]
        try:
            yield r
        finally:
            await r.aclose()

    app.dependency_overrides[get_db] = _get_test_db
    app.dependency_overrides[get_redis] = _get_test_redis

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c  # type: ignore[misc]

    asyncio.run(engine.dispose())
    # redis_pool was opened inside TestClient's event loop which is now closed;
    # connections are released when the pool is garbage collected.
