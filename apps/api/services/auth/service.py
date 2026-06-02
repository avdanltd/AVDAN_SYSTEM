"""Auth service — business logic only, no HTTP concerns."""
from __future__ import annotations

import secrets

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AuthException, ConflictException, ValidationException
from core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from services.auth.models import User
from services.auth.schemas import LoginRequest, RegisterCustomerRequest, RegisterVendorRequest

_OTP_TTL = 600  # 10 minutes


class AuthService:
    def __init__(self, db: AsyncSession, redis: aioredis.Redis) -> None:  # type: ignore[type-arg]
        self.db = db
        self.redis = redis

    async def register_customer(self, data: RegisterCustomerRequest) -> tuple[User, str]:
        await self._assert_unique(email=data.email, phone=data.phone)
        user = User(
            role="customer",
            email=data.email,
            phone=data.phone,
            password_hash=hash_password(data.password),
            name=data.name,
            status="pending",
        )
        self.db.add(user)
        await self.db.flush()
        otp = await self._generate_otp(str(user.id))
        return user, otp

    async def verify_otp(self, user_id: str, otp: str) -> User:
        stored = await self.redis.get(f"otp:{user_id}")
        if not stored or stored != otp:
            raise ValidationException("Invalid or expired OTP")

        result = await self.db.execute(select(User).where(User.id == user_id))  # type: ignore[arg-type]
        user = result.scalar_one_or_none()
        if not user:
            raise ValidationException("User not found")

        user.status = "active"
        await self.redis.delete(f"otp:{user_id}")
        return user

    async def login(self, data: LoginRequest) -> tuple[str, str, str]:
        """Returns (access_token, refresh_token, jti)."""
        result = await self.db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(data.password, user.password_hash):
            raise AuthException("Invalid credentials")

        if user.status != "active":
            raise AuthException("Account is not active")

        access_token = create_access_token(str(user.id), user.role)
        refresh_token, jti = create_refresh_token(str(user.id))
        return access_token, refresh_token, jti

    async def get_user_by_id(self, user_id: str) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))  # type: ignore[arg-type]
        user = result.scalar_one_or_none()
        if not user:
            raise AuthException("User not found")
        return user

    async def _assert_unique(self, email: str | None, phone: str | None) -> None:
        if email:
            result = await self.db.execute(select(User).where(User.email == email))
            if result.scalar_one_or_none():
                raise ConflictException("Email already registered")
        if phone:
            result = await self.db.execute(select(User).where(User.phone == phone))
            if result.scalar_one_or_none():
                raise ConflictException("Phone already registered")

    async def _generate_otp(self, user_id: str) -> str:
        otp = str(secrets.randbelow(900000) + 100000)  # 6-digit, cryptographically secure
        await self.redis.setex(f"otp:{user_id}", _OTP_TTL, otp)
        return otp
