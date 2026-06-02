from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis

from core.database import get_db
from core.dependencies import get_current_user, CurrentUser
from core.redis import get_redis
from services.auth.schemas import (
    LoginRequest,
    RegisterCustomerRequest,
    TokenResponse,
    UserResponse,
    VerifyOtpRequest,
)
from services.auth.service import AuthService

router = APIRouter()

_COOKIE_OPTS = {
    "httponly": True,
    "samesite": "lax",
    "path": "/",
}


@router.post("/register/customer", response_model=dict, status_code=201)
async def register_customer(
    data: RegisterCustomerRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    svc = AuthService(db, redis)
    user, otp = await svc.register_customer(data)
    # In production, send OTP via SMS/email. For dev, return it directly.
    return {"user_id": str(user.id), "message": "OTP sent", "otp_dev": otp}


@router.post("/verify-otp", response_model=dict)
async def verify_otp(
    data: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    svc = AuthService(db, redis)
    await svc.verify_otp(data.user_id, data.otp)
    return {"message": "Account verified"}


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> TokenResponse:
    from core.config import settings

    svc = AuthService(db, redis)
    access_token, refresh_token, _jti = await svc.login(data)

    secure = settings.is_production
    response.set_cookie("avdan_token", access_token, secure=secure, **_COOKIE_OPTS)
    response.set_cookie("avdan_refresh_token", refresh_token, secure=secure, **_COOKIE_OPTS)
    return TokenResponse(message="Login successful")


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie("avdan_token")
    response.delete_cookie("avdan_refresh_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> UserResponse:
    svc = AuthService(db, redis)
    user = await svc.get_user_by_id(current_user.user_id)
    return UserResponse(
        id=str(user.id),
        email=user.email,
        phone=user.phone,
        role=user.role,
        status=user.status,
    )
