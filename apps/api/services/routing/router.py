import json
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from core.dependencies import CurrentUser, get_current_user
from core.exceptions import AppError
from core.redis import get_redis
from services.routing.providers import RouteResult, get_route_provider

router = APIRouter()

_CACHE_TTL_S = 300
# Everything AVDAN serves is in Nigeria: coordinates outside this box are a mistake or an abuse
# attempt (asking the router for huge cross-continent routes), so they are refused cheaply.
_LAT = (3.0, 14.5)
_LNG = (2.0, 15.0)


class RoutePointOut(BaseModel):
    lat: float
    lng: float


class RouteResponse(BaseModel):
    provider: str
    distance_m: int
    duration_s: int
    points: list[RoutePointOut]


def _cache_key(a: tuple[float, float], b: tuple[float, float]) -> str:
    # 4 decimals is about 11 m: close enough that two riders on the same street share one answer.
    return f"route:{a[0]:.4f},{a[1]:.4f}:{b[0]:.4f},{b[1]:.4f}"


@router.get("/route", response_model=RouteResponse)
async def get_route(
    from_lat: Annotated[float, Query(ge=_LAT[0], le=_LAT[1])],
    from_lng: Annotated[float, Query(ge=_LNG[0], le=_LNG[1])],
    to_lat: Annotated[float, Query(ge=_LAT[0], le=_LAT[1])],
    to_lng: Annotated[float, Query(ge=_LNG[0], le=_LNG[1])],
    _user: CurrentUser = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> RouteResponse:
    """The driving route between two points, for the live maps in the apps. Signed-in users only.
    503 when routing is not configured or the provider is down: the apps then draw a straight line."""
    origin, dest = (from_lat, from_lng), (to_lat, to_lng)
    provider = get_route_provider()
    if provider is None:
        raise AppError(503, "ROUTING_UNAVAILABLE", "Routing is not available right now")

    key = _cache_key(origin, dest)
    cached = await redis.get(key)
    if cached:
        data = json.loads(cached)
        return RouteResponse(**data)

    result: RouteResult | None = await provider.route(origin, dest)
    if result is None:
        raise AppError(503, "ROUTING_UNAVAILABLE", "Routing is not available right now")
    response = RouteResponse(
        provider=provider.name, distance_m=result.distance_m, duration_s=result.duration_s,
        points=[RoutePointOut(lat=lat, lng=lng) for lat, lng in result.points],
    )
    await redis.setex(key, _CACHE_TTL_S, response.model_dump_json())
    return response
