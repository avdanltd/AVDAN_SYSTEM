"""Regression tests for the issues the security review found (each fails without its fix)."""
import uuid
from types import SimpleNamespace

import pytest

from core.exceptions import ForbiddenException, ValidationException
from services.auth.models import User
from services.auth.service import AuthService
from services.notification.emails import build_otp_email
from services.orders.models import Order, OrderEvent
from services.orders.router import _order_detail_resp
from services.payment.models import EscrowTransaction
from services.payment.service import PaymentService
from services.vendor.models import Vendor
from services.vendor.router import _vendor_detail_response
from tests.services.test_admin_attention import run


class FakeRedis:
    def __init__(self, otp: str | None = None) -> None:
        self.store: dict[str, str] = {"otp:x": otp} if otp else {}
        self.counters: dict[str, int] = {}

    async def get(self, key: str):  # type: ignore[no-untyped-def]
        return self.store.get(key)

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)
        self.counters.pop(key, None)

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self.store[key] = value

    async def incr(self, key: str) -> int:
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key]

    async def expire(self, key: str, ttl: int) -> None:
        return None


async def _user(db, status):  # type: ignore[no-untyped-def]
    u = User(role="customer", email=f"u{uuid.uuid4().hex[:8]}@t.io", password_hash="x", name="N", status=status)
    db.add(u)
    await db.flush()
    return u


def test_public_vendor_page_carries_no_payout_details() -> None:
    v = Vendor(
        id=uuid.uuid4(), user_id=uuid.uuid4(), name="Shop", slug="shop", status="active", rating=0, review_count=0,
        paystack_recipient_code="RCP_x", payout_bank_name="GTBank", payout_account_name="Ada Obi",
        created_at=__import__("datetime").datetime(2026, 1, 1),
    )
    v.products = []
    public = _vendor_detail_response(v, public=True)
    assert (public.payout_bank_name, public.payout_account_name, public.has_payout_account) == (None, None, False)
    assert "GTBank" not in public.model_dump_json() and "Ada" not in public.model_dump_json()
    own = _vendor_detail_response(v, public=False)  # the vendor's own view keeps them
    assert own.payout_bank_name == "GTBank" and own.has_payout_account is True


def test_otp_cannot_reactivate_a_suspended_or_banned_account() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        banned = await _user(db, "banned")
        redis = FakeRedis()
        redis.store[f"otp:{banned.id}"] = "123456"
        svc = AuthService(db, redis)  # type: ignore[arg-type]
        with pytest.raises(ValidationException):
            await svc.verify_otp(str(banned.id), "123456")
        with pytest.raises(ValidationException):
            await svc.resend_otp(str(banned.id))
        assert banned.status == "banned"

        pending = await _user(db, "pending")
        redis.store[f"otp:{pending.id}"] = "654321"
        await svc.verify_otp(str(pending.id), "654321")
        assert pending.status == "active"
    run(body)


def test_only_the_customer_and_staff_can_read_an_orders_escrow() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        owner = uuid.uuid4()
        svc = PaymentService(db)

        async def _order(_id):  # type: ignore[no-untyped-def]
            return SimpleNamespace(customer_id=owner)

        async def _escrow(_id):  # type: ignore[no-untyped-def]
            return SimpleNamespace(amount_kobo=1500)

        svc._get_order = _order  # type: ignore[method-assign]
        svc._get_escrow_for_order = _escrow  # type: ignore[method-assign]
        for role in ("vendor", "rider", "agent"):
            with pytest.raises(ForbiddenException):
                await svc.get_escrow_for_order("o", str(uuid.uuid4()), role)
        with pytest.raises(ForbiddenException):  # another customer
            await svc.get_escrow_for_order("o", str(uuid.uuid4()), "customer")
        assert (await svc.get_escrow_for_order("o", str(owner), "customer")).amount_kobo == 1500
        assert (await svc.get_escrow_for_order("o", str(uuid.uuid4()), "support")).amount_kobo == 1500
    run(body)


def test_refund_records_the_state_change_first_and_works_from_vendor_rejected() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        import services.payment.service as payment_service

        cust = await _user(db, "active")
        vu = await _user(db, "active")
        vendor = Vendor(user_id=vu.id, name="S", slug=f"s-{uuid.uuid4().hex[:6]}", status="active")
        db.add(vendor)
        await db.flush()
        order = Order(customer_id=cust.id, vendor_id=vendor.id, status="VENDOR_REJECTED", total_kobo=1000,
                      delivery_fee_kobo=0, delivery_address={"street": "s"})
        db.add(order)
        await db.flush()
        escrow = EscrowTransaction(order_id=order.id, provider="fake", provider_ref=f"r-{uuid.uuid4().hex}", amount_kobo=1000, status="HELD")
        db.add(escrow)
        await db.flush()

        calls: list[str] = []

        class FakeProvider:
            async def refund(self, ref, amount):  # type: ignore[no-untyped-def]
                calls.append(f"refund:{order.status}")  # the state change must already be recorded
                return SimpleNamespace(refund_ref="rf_1")

        original = payment_service.get_provider
        payment_service.get_provider = lambda _name: FakeProvider()  # type: ignore[assignment]
        try:
            await PaymentService(db).process_refund(str(order.id), 1000, str(cust.id), "test")
        finally:
            payment_service.get_provider = original  # type: ignore[assignment]
        assert calls == ["refund:REFUND_INITIATED"] and order.status == "REFUND_INITIATED" and escrow.status == "REFUNDED"
    run(body)


def test_vendors_never_see_event_metadata() -> None:
    o = Order(
        id=uuid.uuid4(), customer_id=uuid.uuid4(), vendor_id=uuid.uuid4(), status="PAID", total_kobo=1, delivery_fee_kobo=0,
        delivery_address={"street": "s"}, items=[], created_at=__import__("datetime").datetime(2026, 1, 1),
        updated_at=__import__("datetime").datetime(2026, 1, 1),
    )
    o.events = [OrderEvent(id=uuid.uuid4(), order_id=o.id, from_state="PAID", to_state="DISPUTED", actor_role="customer",
                           event_metadata={"reason": "call me on MARKER-PHONE", "rider_id": "MARKER-RIDER"},
                           created_at=__import__("datetime").datetime(2026, 1, 1))]
    vendor_json = _order_detail_resp(o, vendor_view=True).model_dump_json()
    assert "MARKER-PHONE" not in vendor_json and "MARKER-RIDER" not in vendor_json
    assert "MARKER-PHONE" in _order_detail_resp(o, vendor_view=False).model_dump_json()  # others still get it


def test_otp_email_escapes_the_name() -> None:
    html = build_otp_email('<a href="https://evil.example">Verify here</a>', "123456")
    assert '<a href="https://evil' not in html and "&lt;a href=" in html


def test_delivery_code_attempts_are_counted_before_they_are_judged() -> None:
    from services.dispatch.service import DispatchService

    async def body(db):  # type: ignore[no-untyped-def]
        redis = FakeRedis()
        svc = DispatchService(db, redis)  # type: ignore[arg-type]
        order = SimpleNamespace(id=uuid.uuid4(), delivery_code="4821")
        for guess in ("0000", "0001", "0002", "0003", "0004"):
            with pytest.raises(ValidationException, match="not correct"):
                await svc._check_delivery_code(order, guess)  # type: ignore[arg-type]
        with pytest.raises(ValidationException, match="Too many"):  # the 6th is refused even if right
            await svc._check_delivery_code(order, "4821")  # type: ignore[arg-type]
    run(body)
