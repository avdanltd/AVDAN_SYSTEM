"""The reviewer demo accounts: created active, able to sign in, and safe to run twice."""
import pytest
from sqlalchemy import select

from core.security import verify_password
from scripts.seed_review_accounts import (
    CUSTOMER_EMAIL,
    RIDER_EMAIL,
    VENDOR_EMAIL,
    create_review_accounts,
)
from services.auth.models import User
from services.vendor.models import Vendor
from tests.services.test_admin_attention import run


def test_creates_active_accounts_and_is_idempotent() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        await create_review_accounts(db, "a-long-test-password-1")
        await create_review_accounts(db, "a-long-test-password-2")  # again: same accounts, new password
        for email, role in ((CUSTOMER_EMAIL, "customer"), (VENDOR_EMAIL, "vendor"), (RIDER_EMAIL, "rider")):
            rows = (await db.execute(select(User).where(User.email == email))).scalars().all()
            assert len(rows) == 1 and rows[0].role == role and rows[0].status == "active"
            assert verify_password("a-long-test-password-2", rows[0].password_hash)
        vendor = (await db.execute(select(Vendor).join(User, User.id == Vendor.user_id).where(User.email == VENDOR_EMAIL))).scalar_one()
        assert vendor.status == "active"
    run(body)


def test_refuses_a_weak_password() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        with pytest.raises(ValueError):
            await create_review_accounts(db, "short")
    run(body)
