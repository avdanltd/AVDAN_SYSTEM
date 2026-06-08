from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from core.redis import get_redis
from services.dispatch.schemas import (
    AssignRiderResponse,
    AvailabilityUpdate,
    LocationUpdate,
    RiderResponse,
)
from services.dispatch.service import DispatchService

router = APIRouter()


def _rider_resp(rider: object) -> RiderResponse:
    from services.dispatch.models import Rider
    r: Rider = rider  # type: ignore[assignment]
    return RiderResponse(
        id=str(r.id),
        user_id=str(r.user_id),
        zone_id=str(r.zone_id) if r.zone_id else None,
        online=r.online,
        vehicle_type=r.vehicle_type,
        lat=float(r.lat) if r.lat is not None else None,
        lng=float(r.lng) if r.lng is not None else None,
    )


# ── Rider endpoints ───────────────────────────────────────────────────────────

@router.post("/me/availability", response_model=RiderResponse)
async def set_availability(
    data: AvailabilityUpdate,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> RiderResponse:
    svc = DispatchService(db, redis)
    rider = await svc.set_availability(current_user.user_id, data.online)
    return _rider_resp(rider)


@router.post("/me/location", response_model=RiderResponse)
async def update_location(
    data: LocationUpdate,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> RiderResponse:
    svc = DispatchService(db, redis)
    rider = await svc.update_location(current_user.user_id, data.lat, data.lng)
    return _rider_resp(rider)


# ── Admin/Dispatch endpoints ──────────────────────────────────────────────────

@router.post("/assign/{order_id}", response_model=AssignRiderResponse)
async def assign_rider(
    order_id: str,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> AssignRiderResponse:
    svc = DispatchService(db, redis)
    rider = await svc.assign_rider(order_id)
    return AssignRiderResponse(
        order_id=order_id,
        rider_id=str(rider.id),
        message="Rider assigned successfully",
    )


@router.get("/riders/available", response_model=list[RiderResponse])
async def get_available_riders(
    zone_id: str | None = Query(default=None),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> list[RiderResponse]:
    svc = DispatchService(db, redis)
    riders = await svc.get_available_riders(zone_id)
    return [_rider_resp(r) for r in riders]
