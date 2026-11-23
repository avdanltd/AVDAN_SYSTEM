"""Regression tests for the second round of security fixes."""
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from core.exceptions import AppError, AuthException, ValidationException
from core.limiter import client_ip
from core.security import create_access_token, create_refresh_token, decode_token
from core.session_guard import block_user, check_token, sign_out_everywhere, unblock_user
from services.analytics.audit import record_audit
from services.auth.models import User
from services.auth.service import AuthService
from services.orders.models import Order
from services.orders.schemas import CreateOrderRequest, DeliveryAddress, OrderItemRequest
from services.orders.service import OrderService
from services.payment.models import EscrowTransaction
from services.payment.service import PaymentService
from services.vendor.models import Product, Vendor
from services.wallet.service import WalletService
from tests.services.test_admin_attention import run


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key):  # type: ignore[no-untyped-def]
        return self.store.get(key)

    async def setex(self, key, ttl, value):  # type: ignore[no-untyped-def]
        self.store[key] = str(value)

    async def delete(self, key):  # type: ignore[no-untyped-def]
        self.store.pop(key, None)

    async def incr(self, key):  # type: ignore[no-untyped-def]
        self.store[key] = str(int(self.store.get(key, 0)) + 1)
        return int(self.store[key])

    async def expire(self, key, ttl):  # type: ignore[no-untyped-def]
        return None


async def _user(db, status="active", role="customer"):  # type: ignore[no-untyped-def]
    u = User(role=role, email=f"u{uuid.uuid4().hex[:8]}@t.io", password_hash="x", name="N", status=status)
    db.add(u)
    await db.flush()
    return u


# ── 1 + 2: suspended/deleted accounts and password resets end live sessions ─────────────────────

def test_tokens_now_carry_an_issue_time() -> None:
    assert decode_token(create_access_token("u1", "customer"))["iat"] > 0
    assert decode_token(create_refresh_token("u1")[0])["iat"] > 0


def test_blocked_account_is_refused_at_once_and_restored_when_reactivated() -> None:
    async def body() -> None:
        redis, uid = FakeRedis(), str(uuid.uuid4())
        payload = decode_token(create_access_token(uid, "vendor"))
        await check_token(redis, payload)  # type: ignore[arg-type]
        await block_user(redis, uid)  # type: ignore[arg-type]
        with pytest.raises(AuthException):
            await check_token(redis, payload)  # type: ignore[arg-type]
        await unblock_user(redis, uid)  # type: ignore[arg-type]
        await check_token(redis, payload)  # type: ignore[arg-type]
    import asyncio

    asyncio.run(body())


def test_password_reset_signs_out_older_tokens_but_not_new_ones() -> None:
    async def body() -> None:
        redis, uid = FakeRedis(), str(uuid.uuid4())
        old = {"sub": uid, "iat": int(datetime.now(UTC).timestamp()) - 3600}
        legacy = {"sub": uid}  # a token from before iat existed
        await check_token(redis, old)  # type: ignore[arg-type]  # no cutoff yet: fine
        await sign_out_everywhere(redis, uid)  # type: ignore[arg-type]
        for dead in (old, legacy):
            with pytest.raises(AuthException):
                await check_token(redis, dead)  # type: ignore[arg-type]
        await check_token(redis, {"sub": uid, "iat": int(datetime.now(UTC).timestamp()) + 1})  # type: ignore[arg-type]
    import asyncio

    asyncio.run(body())


# ── 3: duplicate / late payment is refunded, not kept ────────────────────────────────────────────

def test_second_payment_for_a_paid_order_is_marked_duplicate_and_refunded() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        import services.payment.service as payment_service
        import workers.tasks.escrow as escrow_tasks

        cust, vu = await _user(db), await _user(db, role="vendor")
        vendor = Vendor(user_id=vu.id, name="S", slug=f"s-{uuid.uuid4().hex[:6]}", status="active")
        db.add(vendor)
        await db.flush()
        order = Order(customer_id=cust.id, vendor_id=vendor.id, status="PAID", total_kobo=1000, delivery_fee_kobo=0,
                      delivery_address={"street": "s"})
        db.add(order)
        await db.flush()
        ref = f"dup-{uuid.uuid4().hex}"
        escrow = EscrowTransaction(order_id=order.id, provider="paystack", provider_ref=ref, amount_kobo=1000, status="INITIATED")
        db.add(escrow)
        await db.flush()

        queued: list[str] = []
        original_task = escrow_tasks.refund_duplicate_payment.apply_async
        escrow_tasks.refund_duplicate_payment.apply_async = lambda args, countdown=0: queued.append(args[0])  # type: ignore[method-assign]
        try:
            await PaymentService(db).handle_charge_success(ref, {"data": {"amount": 1000}})  # must not raise
        finally:
            escrow_tasks.refund_duplicate_payment.apply_async = original_task  # type: ignore[method-assign]
        assert escrow.status == "DUPLICATE" and queued == [str(escrow.id)] and order.status == "PAID"

        class FakeProvider:
            async def refund(self, provider_ref, amount):  # type: ignore[no-untyped-def]
                return SimpleNamespace(refund_ref="rf_dup")

        original = payment_service.get_provider
        payment_service.get_provider = lambda _n: FakeProvider()  # type: ignore[assignment]
        try:
            assert await PaymentService(db).refund_duplicate(str(escrow.id)) is True
            assert await PaymentService(db).refund_duplicate(str(escrow.id)) is False  # only once
        finally:
            payment_service.get_provider = original  # type: ignore[assignment]
        assert escrow.status == "REFUNDED"
    run(body)


# ── 4: stock cannot be oversold ─────────────────────────────────────────────────────────────────

def test_the_same_product_twice_in_an_order_cannot_exceed_stock() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, vu = await _user(db), await _user(db, role="vendor")
        vendor = Vendor(user_id=vu.id, name="S", slug=f"s-{uuid.uuid4().hex[:6]}", status="active")
        db.add(vendor)
        await db.flush()
        product = Product(vendor_id=vendor.id, name="Last one", price_kobo=1000, vendor_price_kobo=1000,
                          approval_status="APPROVED", stock_qty=1, available=True)
        db.add(product)
        await db.flush()
        data = CreateOrderRequest(
            vendor_id=str(vendor.id),
            items=[OrderItemRequest(product_id=str(product.id), quantity=1), OrderItemRequest(product_id=str(product.id), quantity=1)],
            delivery_address=DeliveryAddress(street="1 Road", city="Ikeja", state="Lagos"),
        )
        with pytest.raises(ValidationException, match="Insufficient stock"):
            await OrderService(db).create_order(str(cust.id), data)
        assert product.stock_qty == 1
    run(body)


# ── 5: a swapped payout account cannot be cashed out at once ────────────────────────────────────

def test_withdrawal_is_paused_for_24_hours_after_the_payout_account_is_replaced() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        u = await _user(db, role="vendor")
        svc = WalletService(db)
        await svc._assert_payout_account_settled(str(u.id))  # never changed: fine
        record_audit(db, u.id, "payout.account_change", "vendor", u.id, {"account": "••••1111"}, {"account": "••••2222"})
        await db.flush()
        with pytest.raises(AppError) as exc:
            await svc._assert_payout_account_settled(str(u.id))
        assert exc.value.code == "PAYOUT_ACCOUNT_RECENTLY_CHANGED"
    run(body)


# ── 6: rate limits and guessing caps ────────────────────────────────────────────────────────────

def test_rate_limit_key_is_the_real_client_not_the_proxy() -> None:
    proxied = SimpleNamespace(headers={"x-real-ip": "41.58.1.9"}, client=SimpleNamespace(host="172.18.0.5"))
    assert client_ip(proxied) == "41.58.1.9"  # type: ignore[arg-type]
    direct = SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))
    assert client_ip(direct) == "127.0.0.1"  # type: ignore[arg-type]


def test_otp_is_burnt_after_five_wrong_tries() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        u = await _user(db, status="pending")
        redis = FakeRedis()
        redis.store[f"otp:{u.id}"] = "123456"
        svc = AuthService(db, redis)  # type: ignore[arg-type]
        for _ in range(5):
            with pytest.raises(ValidationException, match="Invalid"):
                await svc.verify_otp(str(u.id), "000000")
        with pytest.raises(ValidationException, match="Too many"):  # the 6th, even with the right code
            await svc.verify_otp(str(u.id), "123456")
        assert f"otp:{u.id}" not in redis.store
        assert u.status == "pending"
    run(body)


def test_one_account_is_locked_after_ten_wrong_passwords_from_any_address() -> None:
    from services.auth.schemas import LoginRequest

    async def body(db):  # type: ignore[no-untyped-def]
        from core.security import hash_password

        u = await _user(db)
        u.password_hash = hash_password("the-right-password")
        await db.flush()
        redis = FakeRedis()
        svc = AuthService(db, redis)  # type: ignore[arg-type]
        for _ in range(10):
            with pytest.raises(AuthException, match="Invalid"):
                await svc.login(LoginRequest(email=u.email, password="wrong-password"))
        with pytest.raises(AuthException, match="Too many"):
            await svc.login(LoginRequest(email=u.email, password="wrong-password"))
    run(body)
