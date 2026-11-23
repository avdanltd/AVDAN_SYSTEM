"""
Demo accounts for the App Store / Google Play reviewers.

Apple and Google test every app with a real login. Vendor and rider accounts are invite-only, so
without ready-made accounts a reviewer is stuck at the sign-in screen and the app is rejected.

Creates (or refreshes) three ACTIVE accounts: a customer, an approved vendor with one approved
product, and a rider. The password comes from the environment, never from this file:

    REVIEW_ACCOUNT_PASSWORD='a-long-random-password' uv run python scripts/seed_review_accounts.py

Idempotent: running it again resets the password and keeps the same accounts. Put the three emails
and the password in App Store Connect ("App Review Information") and Play Console ("App access").
Delete or disable the accounts once the apps are approved if you do not want them to stay.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

sys.path.insert(0, ".")  # run from apps/api/

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import services.categories.models  # noqa: F401 - registers every mapper
from core.database import AsyncSessionLocal
from core.security import hash_password
from services.auth.models import RiderProfile, User, VendorProfile
from services.dispatch.models import Rider
from services.vendor.models import Product, Vendor

CUSTOMER_EMAIL = "review.customer@avdanstore.com"
VENDOR_EMAIL = "review.vendor@avdanstore.com"
RIDER_EMAIL = "review.rider@avdanstore.com"


async def _user(db: AsyncSession, role: str, email: str, name: str, phone: str, pw_hash: str) -> User:
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(role=role, email=email, phone=phone, name=name, password_hash=pw_hash, status="active")
        db.add(user)
    else:
        user.password_hash, user.status, user.role = pw_hash, "active", role
    await db.flush()
    return user


async def create_review_accounts(db: AsyncSession, password: str) -> dict[str, str]:
    if len(password) < 12:
        raise ValueError("Use a password of at least 12 characters.")
    pw = hash_password(password)

    await _user(db, "customer", CUSTOMER_EMAIL, "Review Customer", "08000000101", pw)

    vu = await _user(db, "vendor", VENDOR_EMAIL, "Review Vendor", "08000000102", pw)
    if not (await db.execute(select(VendorProfile).where(VendorProfile.user_id == vu.id))).scalar_one_or_none():
        db.add(VendorProfile(user_id=vu.id, business_name="Demo Store", business_type="Retail"))
    vendor = (await db.execute(select(Vendor).where(Vendor.user_id == vu.id))).scalar_one_or_none()
    if vendor is None:
        vendor = Vendor(
            user_id=vu.id, name="Demo Store", slug=f"demo-store-{uuid.uuid4().hex[:6]}", status="active",
            description="A demo store used by app reviewers to try AVDAN.", street="1 Demo Street", city="Ikeja",
            lga="Ikeja", state="Lagos", lat=6.6018, lng=3.3515,
        )
        db.add(vendor)
        await db.flush()
    vendor.status = "active"
    if not (await db.execute(select(Product).where(Product.vendor_id == vendor.id))).first():
        db.add(Product(
            vendor_id=vendor.id, name="Demo Product", description="A sample product for reviewers.",
            price_kobo=500_000, vendor_price_kobo=450_000, approval_status="APPROVED", stock_qty=50, available=True,
        ))

    ru = await _user(db, "rider", RIDER_EMAIL, "Review Rider", "08000000103", pw)
    if not (await db.execute(select(RiderProfile).where(RiderProfile.user_id == ru.id))).scalar_one_or_none():
        db.add(RiderProfile(user_id=ru.id))
    if not (await db.execute(select(Rider).where(Rider.user_id == ru.id))).scalar_one_or_none():
        db.add(Rider(user_id=ru.id, vehicle_type="bike"))
    await db.flush()
    return {"customer": CUSTOMER_EMAIL, "vendor": VENDOR_EMAIL, "rider": RIDER_EMAIL}


async def main() -> None:
    password = os.environ.get("REVIEW_ACCOUNT_PASSWORD", "")
    async with AsyncSessionLocal() as db:
        async with db.begin():
            emails = await create_review_accounts(db, password)
    print("Review accounts ready (password is the one you set in REVIEW_ACCOUNT_PASSWORD):")
    for role, email in emails.items():
        print(f"  {role:9s} {email}")


if __name__ == "__main__":
    asyncio.run(main())
