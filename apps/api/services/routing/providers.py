"""Road routing behind one small interface, so the provider can change without touching any app.

The apps never talk to a routing service directly: they ask the API (`GET /routing/route`), the API
asks a provider. That keeps any provider key off the phones, lets us cache and rate-limit in one
place, and means swapping OSRM for a paid service later is a server-side change only.

Today there is one provider: OSRM (the open-source router). Point `ROUTING_OSRM_URL` at our own
instance (see infra/osrm). The public demo server (router.project-osrm.org) is refused on purpose:
its operators say it is not for production use.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT_S = 4.0
_MAX_POINTS = 1500  # a very long route is thinned so the response stays small for phones


@dataclass(frozen=True)
class RouteResult:
    points: list[tuple[float, float]]  # (lat, lng) along the road
    distance_m: int
    duration_s: int


class RouteProvider(Protocol):
    name: str

    async def route(self, origin: tuple[float, float], destination: tuple[float, float]) -> RouteResult | None:
        """The driving route, or None if the provider has none (no road link, provider down...)."""


def _thin(points: list[tuple[float, float]], limit: int = _MAX_POINTS) -> list[tuple[float, float]]:
    if len(points) <= limit:
        return points
    step = len(points) / limit
    thinned = [points[int(i * step)] for i in range(limit)]
    thinned[-1] = points[-1]
    return thinned


class OsrmProvider:
    name = "osrm"

    def __init__(self, base_url: str, client: httpx.AsyncClient | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = client

    async def route(self, origin: tuple[float, float], destination: tuple[float, float]) -> RouteResult | None:
        # OSRM wants lng,lat order.
        coords = f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
        url = f"{self.base_url}/route/v1/driving/{coords}"
        params = {"overview": "full", "geometries": "geojson", "alternatives": "false", "steps": "false"}
        try:
            if self._client is not None:
                resp = await self._client.get(url, params=params, timeout=_TIMEOUT_S)
            else:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, params=params, timeout=_TIMEOUT_S)
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("OSRM route request failed: %s", exc)
            return None
        routes = data.get("routes") or []
        if data.get("code") != "Ok" or not routes:
            return None
        best = routes[0]
        coordinates = (best.get("geometry") or {}).get("coordinates") or []
        points = [(float(lat), float(lng)) for lng, lat in coordinates]
        if len(points) < 2:
            return None
        return RouteResult(points=_thin(points), distance_m=int(best.get("distance", 0)), duration_s=int(best.get("duration", 0)))


def get_route_provider() -> RouteProvider | None:
    """The configured provider, or None when routing is not set up (clients then draw a straight line)."""
    url = settings.routing_osrm_url.strip()
    if not url:
        return None
    if "router.project-osrm.org" in url:
        logger.error("ROUTING_OSRM_URL points at the public OSRM demo server, which is not for production use; routing is disabled")
        return None
    return OsrmProvider(url)
