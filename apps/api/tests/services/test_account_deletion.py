"""Self-service account deletion: anonymise, but never while money or work is in flight."""
import uuid

import pytest
from sqlalchemy import select

from core.exceptions import ValidationException
from core.security import hash_password, verify_password
from services.auth.deletion import delete_account
from services.auth.models import User
from services.notification.models import Notification
from services.orders.models import Order
from services.vendor.models import Vendor
from services.wallet.models import WalletEntry, WalletEntryKind
from tests.services.test_admin_attention import run

PW = "correct horse battery"


async def _user(db, role, **kw):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    u = User(role=role, email=f"{role}{uid}@t.io", phone=kw.pop("phone", f"080{uid[:8]}"[:11]), password_hash=hash_password(PW),
             name="Real Name", status="active", fcm_token="ExponentPushToken[x]", **kw)
    db.add(u)
    await db.flush()
    return u


async def _order(db, customer, vendor, status):  # type: ignore[no-untyped-def]
    o = Order(customer_id=customer.id, vendor_id=vendor.id, status=status, total_kobo=1000, delivery_fee_kobo=0,
              delivery_address={"street": "s"})
    db.add(o)
    await db.flush()
    return o


async def _vendor(db):  # type: ignore[no-untyped-def]
    vu = await _user(db, "vendor")
    v = Vendor(user_id=vu.id, name=f"Shop {uuid.uuid4().hex[:6]}", slug=f"s-{uuid.uuid4().hex[:8]}", status="active",
               payout_account_number="0123456789", payout_bank_name="GTB", payout_account_name="Real Name")
    db.add(v)
    await db.flush()
    return vu, v


def test_customer_is_anonymised_and_cannot_sign_in_again() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        c = await _user(db, "customer")
        _, v = await _vendor(db)
        await _order(db, c, v, "COMPLETED")  # finished orders do not block
        db.add(Notification(user_id=c.id, type="x", channel="in_app", content={"title": "t", "body": "b"}))
        await db.flush()
        cid = c.id

        await delete_account(db, str(cid), PW)
        await db.refresh(c)
        assert c.status == "deleted" and c.name == "Deleted user" and c.phone is None and c.fcm_token is None
        assert "deleted" in c.email and not verify_password(PW, c.password_hash)
        assert (await db.execute(select(Notification).where(Notification.user_id == cid))).scalars().all() == []
        assert (await db.execute(select(Order).where(Order.customer_id == cid))).scalars().all()  # records kept

        with pytest.raises(ValidationException):  # already gone
            await delete_account(db, str(cid), PW)
    run(body)


def test_wrong_password_and_orders_in_progress_block_deletion() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        c = await _user(db, "customer")
        _, v = await _vendor(db)
        with pytest.raises(ValidationException, match="password"):
            await delete_account(db, str(c.id), "nope")
        await _order(db, c, v, "OUT_FOR_DELIVERY")
        with pytest.raises(ValidationException, match="in progress"):
            await delete_account(db, str(c.id), PW)
        assert c.status == "active"
    run(body)


def test_vendor_with_money_is_blocked_then_store_comes_off_the_marketplace() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        vu, v = await _vendor(db)
        entry = WalletEntry(owner_type="vendor", owner_id=v.id, kind=WalletEntryKind.ORDER_CREDIT, amount_kobo=5000,
                            order_id=None, entry_metadata={})
        db.add(entry)
        await db.flush()
        with pytest.raises(ValidationException, match="wallet"):
            await delete_account(db, str(vu.id), PW)

        # the ledger is append-only: the money leaves through an offsetting entry (a withdrawal)
        db.add(WalletEntry(owner_type="vendor", owner_id=v.id, kind="PAYOUT", amount_kobo=-5000, entry_metadata={}))
        await db.flush()
        await delete_account(db, str(vu.id), PW)
        await db.refresh(v)
        assert v.status == "suspended" and v.is_open is False
        assert v.payout_account_number is None and v.payout_account_name is None
    run(body)


def test_staff_cannot_self_delete() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        a = await _user(db, "admin")
        with pytest.raises(ValidationException, match="admin"):
            await delete_account(db, str(a.id), PW)
    run(body)


# ── End to end through the API: delete, and the old login stops working at once ────────────────

def test_deleting_through_the_api_ends_the_session_immediately(client) -> None:  # type: ignore[no-untyped-def]
    from tests.services.test_auth import _login, _register_and_activate

    acct = _register_and_activate(client)
    _login(client, acct["email"], acct["password"])
    assert client.get("/auth/me").status_code == 200  # the cookie works

    wrong = client.post("/auth/me/delete-account", json={"password": "not-my-password"})
    assert wrong.status_code in (400, 422) and client.get("/auth/me").status_code == 200  # nothing happened

    # Keep a copy of the live access token: deleting clears the cookie, but a stolen copy must be dead too.
    token = client.cookies.get("avdan_token")
    done = client.post("/auth/me/delete-account", json={"password": acct["password"]})
    assert done.status_code == 200, done.text

    client.cookies.clear()
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert client.post("/auth/login", json={"email": acct["email"], "password": acct["password"]}).status_code in (400, 401)
