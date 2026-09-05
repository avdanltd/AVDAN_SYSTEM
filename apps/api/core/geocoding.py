"""Address -> coordinates via Nominatim (OpenStreetMap).

Best-effort only: the public Nominatim instance is rate-limited to 1 req/sec and forbids bulk
use (https://operations.osmfoundation.org/policies/nominatim/), which is fine for one-off
geocoding at vendor registration/profile-update time but would need a self-hosted instance if
registration volume ever grows. Callers must not block on this — a vendor without coordinates
simply falls back to zone-based matching.
"""
from __future__ import annotations

import httpx

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_USER_AGENT = "AVDAN/1.0 (avdanstore.com; contact: netojaycee@gmail.com)"


async def geocode_address(address: str) -> tuple[float, float] | None:
    """Returns (lat, lng) for the given address, or None if it couldn't be resolved."""
    if not address or not address.strip():
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                _NOMINATIM_URL,
                params={"q": address, "format": "json", "limit": 1},
                headers={"User-Agent": _USER_AGENT},
            )
        if response.status_code != 200:
            return None
        results = response.json()
        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        return None
