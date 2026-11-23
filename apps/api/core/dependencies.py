from collections.abc import Callable

import redis.asyncio as aioredis
from fastapi import Cookie, Depends, Header

from core.exceptions import AuthException, ForbiddenException
from core.redis import get_redis
from core.security import decode_token
from core.session_guard import check_token


class CurrentUser:
    def __init__(self, user_id: str, role: str) -> None:
        self.user_id = user_id
        self.role = role


async def get_current_user(
    avdan_token: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> CurrentUser:
    token = avdan_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]

    if not token:
        raise AuthException("Authentication required")

    payload = decode_token(token)
    if not payload:
        raise AuthException("Invalid or expired token")

    if payload.get("type") != "access":
        raise AuthException("Invalid token type")

    user_id = payload.get("sub")
    role = payload.get("role")

    if not user_id or not role:
        raise AuthException("Malformed token payload")

    # A suspended, banned or deleted account, or a token from before a password reset, is refused
    # at once instead of working until the 15-minute token expires.
    await check_token(redis, payload)

    return CurrentUser(user_id=str(user_id), role=str(role))


def require_role(*roles: str) -> Callable[[CurrentUser], CurrentUser]:
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise ForbiddenException(
                f"This action requires one of: {', '.join(roles)}"
            )
        return current_user

    return dependency
