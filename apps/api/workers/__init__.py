from collections.abc import Coroutine


async def run_and_dispose(coro: Coroutine[None, None, None]) -> None:
    """Run one task body, then dispose the shared engine's pool before this loop closes.

    Every Celery task here runs its DB work inside its own `asyncio.run()`, which tears down
    its event loop when done. SQLAlchemy's pooled asyncpg connections are bound to the loop
    that created them, so a connection left checked-in survives the loop's death and poisons
    the next `asyncio.run()` in the same forked worker process — `pool_pre_ping` then tries to
    ping a connection whose internal waiters reference a closed loop, raising "attached to a
    different loop". Disposing here, while this task's loop is still the active one, guarantees
    nothing is left pooled for the next task to trip over.
    """
    from core.database import engine

    try:
        await coro
    finally:
        await engine.dispose()
