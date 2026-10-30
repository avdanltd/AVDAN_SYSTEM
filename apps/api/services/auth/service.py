"""Auth service — business logic only, no HTTP concerns."""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.exceptions import AuthException, ConflictException, ValidationException
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from services.auth.models import User, VendorProfile
from services.auth.schemas import (
    AdminCreateUserRequest,
    LoginRequest,
    RegisterCustomerRequest,
    RegisterVendorRequest,
    UpdateProfileRequest,
)

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
        
        if user.email:
            from workers.tasks.notifications import send_otp_email_task
            send_otp_email_task.delay(user.email, user.name, otp)
            
        return user, otp

    async def register_vendor(self, data: RegisterVendorRequest) -> tuple[User, str]:
        await self._assert_unique(email=data.email, phone=data.phone)
        user = User(
            role="vendor",
            email=data.email,
            phone=data.phone,
            password_hash=hash_password(data.password),
            name=data.name,
            status="pending",
        )
        self.db.add(user)
        await self.db.flush()

        profile = VendorProfile(
            user_id=user.id,
            business_name=data.business_name,
            business_type=data.business_type,
            description=data.description,
        )
        self.db.add(profile)

        otp = await self._generate_otp(str(user.id))
        
        if user.email:
            from workers.tasks.notifications import send_otp_email_task
            send_otp_email_task.delay(user.email, user.name, otp)
            
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

    async def resend_otp(self, user_id: str) -> str:
        user = await self.get_user_by_id(user_id)
        otp = await self._generate_otp(str(user.id))
        
        if user.email:
            from workers.tasks.notifications import send_otp_email_task
            send_otp_email_task.delay(user.email, user.name, otp)
            
        return otp

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

    async def refresh_tokens(self, refresh_token_str: str) -> tuple[str, str]:
        """Validates the refresh token, blacklists it, and issues a new pair."""
        payload = decode_token(refresh_token_str)
        if not payload or payload.get("type") != "refresh":
            raise AuthException("Invalid refresh token")

        jti = payload.get("jti")
        user_id = payload.get("sub")

        if not jti or not user_id:
            raise AuthException("Malformed refresh token")

        if await self.redis.exists(f"revoked:{jti}"):
            raise AuthException("Refresh token has been revoked")

        user = await self.get_user_by_id(user_id)
        if user.status != "active":
            raise AuthException("Account is not active")

        access_token = create_access_token(str(user.id), user.role)
        new_refresh_token, new_jti = create_refresh_token(str(user.id))

        # Blacklist old JTI for its remaining lifetime
        exp = payload.get("exp")
        remaining_ttl = max(60, int(exp - datetime.now(UTC).timestamp())) if exp else 86400 * 7
        await self.redis.setex(f"revoked:{jti}", remaining_ttl, "1")

        return access_token, new_refresh_token

    async def logout(self, refresh_token_str: str | None) -> None:
        """Blacklists the refresh token JTI so it cannot be reused."""
        if not refresh_token_str:
            return

        payload = decode_token(refresh_token_str)
        if not payload:
            return

        jti = payload.get("jti")
        if not jti:
            return

        exp = payload.get("exp")
        remaining_ttl = max(60, int(exp - datetime.now(UTC).timestamp())) if exp else 86400 * 7
        await self.redis.setex(f"revoked:{jti}", remaining_ttl, "1")

    async def update_profile(self, user_id: str, data: UpdateProfileRequest) -> User:
        user = await self.get_user_by_id(user_id)

        if data.name is not None:
            user.name = data.name

        if data.phone is not None and data.phone != user.phone:
            result = await self.db.execute(select(User).where(User.phone == data.phone))
            if result.scalar_one_or_none():
                raise ConflictException("Phone number already in use")
            user.phone = data.phone

        return user

    async def get_user_by_id(self, user_id: str) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))  # type: ignore[arg-type]
        user = result.scalar_one_or_none()
        if not user:
            raise AuthException("User not found")
        return user

    async def create_privileged_user(self, data: AdminCreateUserRequest) -> User:
        """Create a staff account in the `invited` state and email them a link to set their own
        password. Nobody but the account owner ever knows the password."""
        await self._assert_unique(email=data.email, phone=data.phone)
        user = User(
            role=data.role,
            email=data.email,
            phone=data.phone,
            # Unusable placeholder: the column is NOT NULL, and nobody knows this value.
            password_hash=hash_password(secrets.token_urlsafe(32)),
            name=data.name,
            status="invited",
        )
        self.db.add(user)
        await self.db.flush()
        await self._send_invite(user)
        return user

    # ── Invitations ───────────────────────────────────────────────────────────

    @staticmethod
    def _invite_key(token: str) -> str:
        return "invite:" + hashlib.sha256(token.encode()).hexdigest()

    async def _issue_invite_token(self, user: User) -> str:
        """A fresh single-use token; any earlier one for this user stops working."""
        ttl = settings.invite_ttl_hours * 3600
        previous = await self.redis.get(f"invite_user:{user.id}")
        if previous:
            await self.redis.delete(previous if isinstance(previous, str) else previous.decode())
        token = secrets.token_urlsafe(32)
        key = self._invite_key(token)
        await self.redis.setex(key, ttl, str(user.id))
        await self.redis.setex(f"invite_user:{user.id}", ttl, key)
        return token

    @staticmethod
    def _invite_link(user: User, token: str) -> str:
        base = {
            "agent": settings.hub_app_url,
            "rider": settings.rider_app_url,
        }.get(user.role, settings.admin_app_url)
        return f"{base.rstrip('/')}/set-password?token={token}"

    async def _send_invite(self, user: User) -> None:
        token = await self._issue_invite_token(user)
        if user.email:
            from workers.tasks.notifications import send_invite_email_task
            send_invite_email_task.delay(
                user.email, user.name or "", user.role, self._invite_link(user, token),
                settings.invite_ttl_hours,
            )

    async def _get_invited_user(self, user_id: str) -> User:
        user = await self.get_user_by_id(user_id)
        if user.status != "invited":
            raise ValidationException("This account has already been set up")
        return user

    async def resend_invite(self, user_id: str) -> User:
        user = await self._get_invited_user(user_id)
        await self._send_invite(user)
        return user

    async def revoke_invite(self, user_id: str) -> None:
        """Cancel an invitation nobody has claimed yet. The account never held any data, so it is
        removed outright and the email address is free to invite again."""
        user = await self._get_invited_user(user_id)
        previous = await self.redis.get(f"invite_user:{user.id}")
        if previous:
            await self.redis.delete(previous if isinstance(previous, str) else previous.decode())
        await self.redis.delete(f"invite_user:{user.id}")
        await self.db.delete(user)
        await self.db.flush()

    async def _user_for_invite_token(self, token: str) -> User:
        user_id = await self.redis.get(self._invite_key(token))
        if not user_id:
            raise ValidationException("This link is invalid or has expired. Ask your admin to send a new one.")
        user_id = user_id if isinstance(user_id, str) else user_id.decode()
        user = await self.get_user_by_id(user_id)
        if user.status != "invited":
            raise ValidationException("This account has already been set up. Please sign in.")
        return user

    async def preview_invite(self, token: str) -> User:
        return await self._user_for_invite_token(token)

    async def accept_invite(self, token: str, password: str) -> User:
        user = await self._user_for_invite_token(token)
        user.password_hash = hash_password(password)
        user.status = "active"
        await self.redis.delete(self._invite_key(token))
        await self.redis.delete(f"invite_user:{user.id}")
        return user

    async def change_password(self, user_id: str, current_password: str, new_password: str) -> None:
        user = await self.get_user_by_id(user_id)
        if not verify_password(current_password, user.password_hash):
            raise ValidationException("Current password is incorrect")
        user.password_hash = hash_password(new_password)

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
