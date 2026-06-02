from collections.abc import Callable

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.exceptions import AuthException, ForbiddenException
from core.security import decode_token


class CurrentUser:
    def __init__(self, user_id: str, role: str) -> None:
        self.user_id = user_id
        self.role = role


async def get_current_user(
    avdan_token: str | None = Cookie(default=None),
) -> CurrentUser:
    if not avdan_token:
        raise AuthException("Authentication required")

    payload = decode_token(avdan_token)
    if not payload:
        raise AuthException("Invalid or expired token")

    if payload.get("type") != "access":
        raise AuthException("Invalid token type")

    user_id = payload.get("sub")
    role = payload.get("role")

    if not user_id or not role:
        raise AuthException("Malformed token payload")

    return CurrentUser(user_id=str(user_id), role=str(role))


def require_role(*roles: str) -> Callable[[CurrentUser], CurrentUser]:
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise ForbiddenException(
                f"This action requires one of: {', '.join(roles)}"
            )
        return current_user

    return dependency
