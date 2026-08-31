import redis.asyncio as aioredis
from fastapi import APIRouter, Body, Cookie, Depends, Header, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, get_current_user
from core.exceptions import AuthException
from core.redis import get_redis
from services.auth.schemas import (
    LoginRequest,
    LogoutRequest,
    PushTokenRequest,
    RefreshRequest,
    RegisterCustomerRequest,
    RegisterVendorRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
    VerifyOtpRequest,
)
from services.auth.service import AuthService

router = APIRouter()

_COOKIE_OPTS: dict = {
    "httponly": True,
    "samesite": "lax",
    "path": "/",
}


def _user_response(user: object) -> UserResponse:
    from services.auth.models import User

    u: User = user  # type: ignore[assignment]
    return UserResponse(
        id=str(u.id),
        email=u.email,
        phone=u.phone,
        name=u.name,
        role=u.role,
        status=u.status,
    )


@router.post("/register/customer", response_model=dict, status_code=201)
async def register_customer(
    data: RegisterCustomerRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    from core.config import settings
    svc = AuthService(db, redis)
    user, otp = await svc.register_customer(data)
    res = {"user_id": str(user.id), "message": "OTP sent"}
    if not settings.is_production:
        res["otp_dev"] = otp
    return res


@router.post("/register/vendor", response_model=dict, status_code=201)
async def register_vendor(
    data: RegisterVendorRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    from core.config import settings
    svc = AuthService(db, redis)
    user, otp = await svc.register_vendor(data)
    res = {"user_id": str(user.id), "message": "OTP sent"}
    if not settings.is_production:
        res["otp_dev"] = otp
    return res


@router.post("/resend-otp", response_model=dict)
async def resend_otp(
    data: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    from core.config import settings
    svc = AuthService(db, redis)
    otp = await svc.resend_otp(data.user_id)
    res = {"message": "OTP resent"}
    if not settings.is_production:
        res["otp_dev"] = otp
    return res


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
    x_client_platform: str | None = Header(default=None),
) -> TokenResponse:
    from core.config import settings

    svc = AuthService(db, redis)
    access_token, refresh_token, _jti = await svc.login(data)

    secure = settings.is_production
    response.set_cookie("avdan_token", access_token, secure=secure, **_COOKIE_OPTS)
    response.set_cookie("avdan_refresh_token", refresh_token, secure=secure, **_COOKIE_OPTS)

    is_mobile = (x_client_platform or "").lower() == "mobile"
    return TokenResponse(
        message="Login successful",
        access_token=access_token if is_mobile else None,
        refresh_token=refresh_token if is_mobile else None,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    avdan_refresh_token: str | None = Cookie(default=None),
    data: RefreshRequest | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
    x_client_platform: str | None = Header(default=None),
) -> TokenResponse:
    token = avdan_refresh_token or (data.refresh_token if data else None)
    if not token:
        raise AuthException("Refresh token missing")

    from core.config import settings

    svc = AuthService(db, redis)
    access_token, new_refresh_token = await svc.refresh_tokens(token)

    secure = settings.is_production
    response.set_cookie("avdan_token", access_token, secure=secure, **_COOKIE_OPTS)
    response.set_cookie("avdan_refresh_token", new_refresh_token, secure=secure, **_COOKIE_OPTS)

    is_mobile = (x_client_platform or "").lower() == "mobile"
    return TokenResponse(
        message="Token refreshed",
        access_token=access_token if is_mobile else None,
        refresh_token=new_refresh_token if is_mobile else None,
    )


@router.post("/logout")
async def logout(
    response: Response,
    avdan_refresh_token: str | None = Cookie(default=None),
    data: LogoutRequest | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    token = avdan_refresh_token or (data.refresh_token if data else None)
    svc = AuthService(db, redis)
    await svc.logout(token)
    response.delete_cookie("avdan_token", path="/")
    response.delete_cookie("avdan_refresh_token", path="/")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> UserResponse:
    svc = AuthService(db, redis)
    user = await svc.get_user_by_id(current_user.user_id)
    return _user_response(user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UpdateProfileRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> UserResponse:
    svc = AuthService(db, redis)
    user = await svc.update_profile(current_user.user_id, data)
    return _user_response(user)


@router.patch("/me/push-token", response_model=dict)
async def update_push_token(
    data: PushTokenRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    from sqlalchemy import select

    from services.auth.models import User
    result = await db.execute(
        select(User).where(User.id == current_user.user_id)  # type: ignore[arg-type]
    )
    user = result.scalar_one_or_none()
    if user:
        user.fcm_token = data.token
    return {"message": "Push token updated"}
