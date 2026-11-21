"""Admin vendor profile checklist and the admin <-> vendor message thread."""
import uuid

import pytest
from sqlalchemy import select

from core.exceptions import ValidationException
from services.admin.service import AdminService
from services.auth.models import User
from services.notification.models import Notification
from services.vendor.messages import list_thread, post_message, unread_count
from services.vendor.models import Product, Vendor
from tests.services.test_admin_attention import run


async def _vendor(db, **kw):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    owner = User(role="vendor", email=f"v{uid}@t.io", phone=kw.pop("phone", None), password_hash="x", name="Owner", status="active")
    db.add(owner)
    await db.flush()
    v = Vendor(user_id=owner.id, name=f"Shop {uid}", slug=f"shop-{uid}", status="pending", **kw)
    db.add(v)
    await db.flush()
    return owner, v


async def _admin(db, role="admin"):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    a = User(role=role, email=f"a{uid}@t.io", password_hash="x", name="Admin", status="active")
    db.add(a)
    await db.flush()
    return a


def test_profile_lists_what_is_missing() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        _, bare = await _vendor(db)
        prof = await AdminService(db).vendor_profile(str(bare.id))
        assert set(prof["missing"]) == {
            "Location (state, LGA, city)", "Street address", "Pickup point pinned on the map",
            "Business description", "Contact phone number",
        }
        pin = next(c for c in prof["checklist"] if c["key"] == "pickup_pin")
        assert pin["ok"] is False and "flat delivery fee" in pin["detail"]

        _, full = await _vendor(
            db, phone="08012345678", state="Ogun", lga="Ado Odo/Ota", city="Sango Ota", street="7 Alishiba St",
            description="Retail of groceries and household appliances.", lat=6.69, lng=3.23,
            payout_account_number="0123456789", payout_bank_name="GTBank", payout_account_name="Shop Ltd",
        )
        db.add(Product(vendor_id=full.id, name="Rice", price_kobo=1000, vendor_price_kobo=1000, approval_status="PENDING"))
        await db.flush()
        prof = await AdminService(db).vendor_profile(str(full.id))
        assert prof["missing"] == []
        assert prof["payout_account_last4"] == "6789" and "0123456789" not in str(prof)
        assert (prof["product_total"], prof["product_pending"], prof["product_approved"]) == (1, 1, 0)
        assert prof["owner_phone"] == "08012345678"
    run(body)


def test_thread_notifies_the_other_side_and_tracks_unread() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        owner, v = await _vendor(db)
        admin = await _admin(db)
        support = await _admin(db, "support")

        await post_message(db, v, "admin", str(admin.id), "Please pin your pickup location.")
        # the vendor was told in-app; nobody else was
        rows = (await db.execute(select(Notification).where(Notification.type == "vendor_message", Notification.user_id == owner.id))).scalars().all()
        assert len(rows) == 1 and rows[0].content["body"].startswith("Please pin")
        assert await unread_count(db, v.id, "vendor") == 1 and await unread_count(db, v.id, "admin") == 0

        thread = await list_thread(db, v.id, "vendor")  # opening it marks the admin's message read
        assert [m.sender_role for m in thread] == ["admin"]
        assert await unread_count(db, v.id, "vendor") == 0

        await post_message(db, v, "vendor", str(owner.id), "Done, pinned it.")
        got = {n.user_id for n in (await db.execute(select(Notification).where(Notification.type == "vendor_message", Notification.content["vendor_id"].astext == str(v.id), Notification.user_id.in_([admin.id, support.id])))).scalars().all()}
        assert got == {admin.id, support.id}
        assert await unread_count(db, v.id, "admin") == 1
    run(body)


def test_message_validation() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        owner, v = await _vendor(db)
        for bad in ("   ", "x" * 2001):
            with pytest.raises(ValidationException):
                await post_message(db, v, "vendor", str(owner.id), bad)
    run(body)
