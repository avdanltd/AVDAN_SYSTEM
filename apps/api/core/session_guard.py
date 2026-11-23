"""Ending a person's live sessions on demand.

Access tokens are self-contained JWTs that last 15 minutes, so on their own they keep working after
an account is suspended, banned or deleted, or after a password reset. Two small Redis markers fix
that without a database lookup on every request:

* BLOCK  - the account may not act at all (suspended, banned, deleted). Set when that happens,
           cleared when an admin reactivates it. It only needs to outlive an access token.
* CUTOFF - every token issued before this moment is dead (a password reset). It must outlive a
           refresh token, so a stolen refresh token cannot keep minting new access tokens.

Both are checked on each authenticated request and on refresh.
"""
from __future__ import annotations

import time

import redis.asyncio as aioredis

from core.config import settings
from core.exceptions import AuthException

_BLOCK_TTL = 3600  # an access token lives 15 minutes; refresh is refused by the account's DB status
_CUTOFF_TTL = settings.refresh_token_expire_days * 86400 + 3600


def _block_key(user_id: str) -> str:
    return f"auth_block:{user_id}"


def _cutoff_key(user_id: str) -> str:
    return f"auth_cutoff:{user_id}"


async def block_user(redis: aioredis.Redis, user_id: str) -> None:  # type: ignore[type-arg]
    await redis.setex(_block_key(user_id), _BLOCK_TTL, "1")


async def unblock_user(redis: aioredis.Redis, user_id: str) -> None:  # type: ignore[type-arg]
    await redis.delete(_block_key(user_id))


async def sign_out_everywhere(redis: aioredis.Redis, user_id: str) -> None:  # type: ignore[type-arg]
    """Kill every token issued before now (e.g. after a password reset)."""
    await redis.setex(_cutoff_key(user_id), _CUTOFF_TTL, str(int(time.time())))


async def check_token(redis: aioredis.Redis, payload: dict) -> None:  # type: ignore[type-arg]
    """Raise AuthException if this (already signature-checked) token's owner is blocked or the
    token predates a sign-out-everywhere. A token with no `iat` (issued before this existed) is
    treated as very old, so it only survives while no cutoff is set."""
    user_id = str(payload.get("sub") or "")
    if not user_id:
        raise AuthException("Malformed token payload")
    if await redis.get(_block_key(user_id)):
        raise AuthException("This account is not active")
    cutoff = await redis.get(_cutoff_key(user_id))
    if cutoff is not None and int(payload.get("iat") or 0) < int(cutoff):
        raise AuthException("Your session has ended. Please sign in again.")
