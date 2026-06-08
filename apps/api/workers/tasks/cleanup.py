"""Housekeeping tasks."""
from __future__ import annotations

import asyncio
from datetime import date, timedelta

from workers.celery_app import celery_app


@celery_app.task(name="workers.tasks.cleanup.purge_old_rider_partitions")
def purge_old_rider_partitions() -> None:
    """Create upcoming day partitions and drop partitions older than 90 days."""
    asyncio.run(_purge_async())


async def _purge_async() -> None:
    from sqlalchemy import text
    from core.database import AsyncSessionLocal

    today = date.today()

    async with AsyncSessionLocal() as db:
        async with db.begin():
            # Create partitions for the next 7 days (idempotent via IF NOT EXISTS)
            for i in range(7):
                day = today + timedelta(days=i)
                next_day = day + timedelta(days=1)
                partition_name = f"rider_locations_{day.strftime('%Y%m%d')}"
                await db.execute(text(f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_tables
                            WHERE tablename = '{partition_name}'
                        ) THEN
                            EXECUTE '
                                CREATE TABLE {partition_name}
                                PARTITION OF rider_locations
                                FOR VALUES FROM (''{day}'') TO (''{next_day}'')
                            ';
                        END IF;
                    END $$
                """))

            # Drop partitions older than 90 days
            cutoff = today - timedelta(days=90)
            result = await db.execute(text("""
                SELECT tablename FROM pg_tables
                WHERE tablename LIKE 'rider_locations_%'
                  AND tablename ~ '^rider_locations_[0-9]{8}$'
            """))
            partition_names = [row[0] for row in result.all()]

            for name in partition_names:
                date_str = name.replace("rider_locations_", "")
                try:
                    partition_date = date(
                        int(date_str[:4]),
                        int(date_str[4:6]),
                        int(date_str[6:8]),
                    )
                    if partition_date < cutoff:
                        await db.execute(text(f"DROP TABLE IF EXISTS {name}"))
                except ValueError:
                    pass
