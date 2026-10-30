"""Staff invitations: admin creates an account, the person sets their own password from a link."""
import asyncio
import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.exceptions import AuthException, ValidationException
from services.auth.models import User
from services.auth.schemas import AdminCreateUserRequest, LoginRequest
from services.auth.service import AuthService
from tests.conftest import TEST_DATABASE_URL


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key):
        return self.store.get(key)

    async def setex(self, key, ttl, value):
        self.store[key] = value

    async def delete(self, key):
        self.store.pop(key, None)


@pytest.fixture
def sent(monkeypatch):  # type: ignore[no-untyped-def]
    """Capture invitation emails instead of queueing them on Celery."""
    out: list[tuple] = []
    monkeypatch.setattr(
        "workers.tasks.notifications.send_invite_email_task.delay", lambda *a: out.append(a)
    )
    return out


def run(coro_fn):  # type: ignore[no-untyped-def]
    async def _go():  # type: ignore[no-untyped-def]
        engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                await coro_fn(db)
                await db.rollback()
        finally:
            await engine.dispose()
    asyncio.run(_go())


def _req(role: str = "agent") -> AdminCreateUserRequest:
    uid = uuid.uuid4().hex[:8]
    return AdminCreateUserRequest(email=f"{uid}@t.io", name="New Person", role=role)


def _token_from(link: str) -> str:
    return link.split("token=")[1]


def test_invite_then_set_password_then_login(sent) -> None:  # type: ignore[no-untyped-def]
    async def body(db):  # type: ignore[no-untyped-def]
        svc = AuthService(db, FakeRedis())
        user = await svc.create_privileged_user(_req("agent"))
        assert user.status == "invited"
        email, _name, role, link, _hours = sent[0]
        assert email == user.email and role == "agent"
        assert "/set-password?token=" in link and "hub." in link

        # Can't sign in before claiming the account.
        with pytest.raises(AuthException):
            await svc.login(LoginRequest(email=user.email, password="anything-at-all"))

        token = _token_from(link)
        assert (await svc.preview_invite(token)).id == user.id
        await svc.accept_invite(token, "my-own-password")
        assert user.status == "active"
        access, _refresh, _jti = await svc.login(LoginRequest(email=user.email, password="my-own-password"))
        assert access

        # Single use.
        with pytest.raises(ValidationException):
            await svc.accept_invite(token, "another-password")
    run(body)


def test_resend_invalidates_the_old_link(sent) -> None:  # type: ignore[no-untyped-def]
    async def body(db):  # type: ignore[no-untyped-def]
        svc = AuthService(db, FakeRedis())
        user = await svc.create_privileged_user(_req("rider"))
        first = _token_from(sent[0][3])
        await svc.resend_invite(str(user.id))
        second = _token_from(sent[1][3])
        assert first != second
        assert "rider." in sent[1][3]
        with pytest.raises(ValidationException):
            await svc.accept_invite(first, "my-own-password")
        await svc.accept_invite(second, "my-own-password")
        # Already claimed: nothing left to resend.
        with pytest.raises(ValidationException):
            await svc.resend_invite(str(user.id))
    run(body)


def test_revoke_removes_unclaimed_account_and_kills_link(sent) -> None:  # type: ignore[no-untyped-def]
    async def body(db):  # type: ignore[no-untyped-def]
        svc = AuthService(db, FakeRedis())
        user = await svc.create_privileged_user(_req("admin"))
        token = _token_from(sent[0][3])
        assert "admin." in sent[0][3]
        await svc.revoke_invite(str(user.id))
        assert (await db.execute(select(User).where(User.id == user.id))).scalar_one_or_none() is None
        with pytest.raises(ValidationException):
            await svc.preview_invite(token)
    run(body)


def test_cannot_revoke_a_claimed_account(sent) -> None:  # type: ignore[no-untyped-def]
    async def body(db):  # type: ignore[no-untyped-def]
        svc = AuthService(db, FakeRedis())
        user = await svc.create_privileged_user(_req())
        await svc.accept_invite(_token_from(sent[0][3]), "my-own-password")
        with pytest.raises(ValidationException):
            await svc.revoke_invite(str(user.id))
    run(body)


def test_change_password_needs_current_password(sent) -> None:  # type: ignore[no-untyped-def]
    async def body(db):  # type: ignore[no-untyped-def]
        svc = AuthService(db, FakeRedis())
        user = await svc.create_privileged_user(_req())
        await svc.accept_invite(_token_from(sent[0][3]), "my-own-password")
        with pytest.raises(ValidationException):
            await svc.change_password(str(user.id), "wrong", "brand-new-pass")
        await svc.change_password(str(user.id), "my-own-password", "brand-new-pass")
        await svc.login(LoginRequest(email=user.email, password="brand-new-pass"))
    run(body)


def test_new_rider_account_works_without_a_profile_row(sent) -> None:  # type: ignore[no-untyped-def]
    """Regression: an admin-created rider got "Rider profile not found" on first load."""
    from services.dispatch.models import Rider
    from services.dispatch.service import DispatchService

    async def body(db):  # type: ignore[no-untyped-def]
        svc = AuthService(db, FakeRedis())
        user = await svc.create_privileged_user(_req("rider"))
        rider = (await db.execute(select(Rider).where(Rider.user_id == user.id))).scalar_one()
        # And an older rider with no Rider row yet still gets one on first use.
        await db.delete(rider)
        await db.flush()
        created = await DispatchService(db, FakeRedis()).get_or_create_rider(str(user.id))  # type: ignore[arg-type]
        assert created.user_id == user.id

        # A non-rider account is still refused.
        other = await svc.create_privileged_user(_req("agent"))
        from core.exceptions import NotFoundException
        with pytest.raises(NotFoundException):
            await DispatchService(db, FakeRedis()).get_or_create_rider(str(other.id))  # type: ignore[arg-type]
    run(body)


def _reset_sent(monkeypatch):  # type: ignore[no-untyped-def]
    out: list[tuple] = []
    monkeypatch.setattr(
        "workers.tasks.notifications.send_password_reset_email_task.delay", lambda *a: out.append(a)
    )
    return out


def test_forgot_password_flow(sent, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    resets = _reset_sent(monkeypatch)

    async def body(db):  # type: ignore[no-untyped-def]
        svc = AuthService(db, FakeRedis())
        user = await svc.create_privileged_user(_req("rider"))
        await svc.accept_invite(_token_from(sent[0][3]), "first-password")

        await svc.request_password_reset(user.email)
        email, _name, link, _mins = resets[0]
        assert email == user.email and "/reset-password?token=" in link and "rider." in link
        token = _token_from(link)

        await svc.complete_password_reset(token, "second-password")
        await svc.login(LoginRequest(email=user.email, password="second-password"))
        with pytest.raises(AuthException):
            await svc.login(LoginRequest(email=user.email, password="first-password"))
        # Single use.
        with pytest.raises(ValidationException):
            await svc.complete_password_reset(token, "third-password")
    run(body)


def test_forgot_password_new_request_replaces_old_link(sent, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    resets = _reset_sent(monkeypatch)

    async def body(db):  # type: ignore[no-untyped-def]
        svc = AuthService(db, FakeRedis())
        user = await svc.create_privileged_user(_req("agent"))
        await svc.accept_invite(_token_from(sent[0][3]), "first-password")
        await svc.request_password_reset(user.email)
        await svc.request_password_reset(user.email)
        first, second = _token_from(resets[0][2]), _token_from(resets[1][2])
        with pytest.raises(ValidationException):
            await svc.complete_password_reset(first, "second-password")
        await svc.complete_password_reset(second, "second-password")
    run(body)


def test_forgot_password_is_silent_for_unknown_and_inactive_accounts(sent, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    resets = _reset_sent(monkeypatch)

    async def body(db):  # type: ignore[no-untyped-def]
        svc = AuthService(db, FakeRedis())
        await svc.request_password_reset("nobody-here@t.io")
        invited = await svc.create_privileged_user(_req("agent"))  # still `invited`
        await svc.request_password_reset(invited.email)
        assert resets == []
    run(body)
