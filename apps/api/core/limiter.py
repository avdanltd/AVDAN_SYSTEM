"""Global rate limiter instance — imported by main.py and individual routers."""
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from core.config import settings


def client_ip(request: Request) -> str:
    """The caller's real address. Behind nginx every connection arrives from the proxy, so
    `request.client.host` is the same for everybody and per-IP limits would be one shared bucket.
    nginx always overwrites X-Real-IP with the true client (Cloudflare's CF-Connecting-IP, accepted
    only from Cloudflare ranges), and the API is not reachable except through nginx."""
    return request.headers.get("x-real-ip") or get_remote_address(request)


# Default: 60 requests/minute per IP. Endpoints can override with @limiter.limit("N/minute").
# In production the counters live in Redis so all gunicorn workers share one count (in memory,
# each worker would count separately and the real limit would be several times higher).
limiter = Limiter(
    key_func=client_ip,
    default_limits=["60/minute"],
    storage_uri=settings.redis_url if settings.is_production else None,
)
