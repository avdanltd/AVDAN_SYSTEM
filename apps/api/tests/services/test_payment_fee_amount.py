"""Paystack can charge the customer more than the order total (fee passed on). The order must
still be confirmed against the amount we asked for, not the amount charged."""
import asyncio
import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.exceptions import AppError
from services.auth.models import User
from services.orders.models import Order
from services.orders.state_machine import OrderStatus
from services.payment.models import EscrowStatus, EscrowTransaction
from services.payment.providers.paystack import PaystackProvider
from services.payment.service import PaymentService
from services.vendor.models import Vendor
from tests.conftest import TEST_DATABASE_URL


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


async def _pending_order(db, *, charge_kobo: int = 372_440):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="C", status="active")
    vu = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
    db.add_all([cust, vu])
    await db.flush()
    vendor = Vendor(user_id=vu.id, name=f"V{uid}", slug=f"v-{uid}", status="active")
    db.add(vendor)
    await db.flush()
    order = Order(customer_id=cust.id, vendor_id=vendor.id, status=OrderStatus.PENDING,
                  total_kobo=285_000, delivery_fee_kobo=87_440, delivery_address={"street": "s"})
    db.add(order)
    await db.flush()
    ref = f"avdan-{order.id}"
    db.add(EscrowTransaction(order_id=order.id, provider="paystack", provider_ref=ref,
                             amount_kobo=charge_kobo, status=EscrowStatus.INITIATED))
    await db.flush()
    return order, ref


class FakeResponse:
    status_code = 200

    def __init__(self, data: dict) -> None:
        self._data = data

    def json(self) -> dict:
        return {"status": True, "data": self._data}


def _fake_http(monkeypatch, data: dict) -> None:  # type: ignore[no-untyped-def]
    class FakeClient:
        async def __aenter__(self):  # type: ignore[no-untyped-def]
            return self

        async def __aexit__(self, *a):  # type: ignore[no-untyped-def]
            return False

        async def get(self, *a, **k):  # type: ignore[no-untyped-def]
            return FakeResponse(data)
    monkeypatch.setattr("services.payment.providers.paystack.httpx.AsyncClient", lambda *a, **k: FakeClient())


def test_verify_uses_requested_amount_when_customer_bears_the_fee(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    _fake_http(monkeypatch, {"status": "success", "amount": 388_264, "requested_amount": 372_440,
                             "reference": "r", "fees": 15_824})

    async def body(db):  # type: ignore[no-untyped-def]
        order, ref = await _pending_order(db)
        monkeypatch.setattr("services.payment.service.get_provider", lambda _n: PaystackProvider("sk"))
        out = await PaymentService(db).verify_and_apply(ref)
        assert out["paid"] is True and out["status"] == OrderStatus.PAID
    run(body)


def test_verify_still_rejects_a_genuinely_different_amount(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    _fake_http(monkeypatch, {"status": "success", "amount": 100_000, "requested_amount": 100_000, "reference": "r"})

    async def body(db):  # type: ignore[no-untyped-def]
        _order, ref = await _pending_order(db)
        monkeypatch.setattr("services.payment.service.get_provider", lambda _n: PaystackProvider("sk"))
        with pytest.raises(AppError) as exc:
            await PaymentService(db).verify_and_apply(ref)
        assert exc.value.code == "AMOUNT_MISMATCH"
    run(body)


def test_webhook_ignores_a_charge_for_the_wrong_amount_but_accepts_the_fee_case() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        order, ref = await _pending_order(db)
        svc = PaymentService(db)
        await svc.handle_charge_success(ref, {"event": "charge.success", "data": {"amount": 1, "requested_amount": 1}})
        assert (await svc._get_order(str(order.id))).status == OrderStatus.PENDING
        await svc.handle_charge_success(
            ref, {"event": "charge.success", "data": {"amount": 388_264, "requested_amount": 372_440}}
        )
        assert (await svc._get_order(str(order.id))).status == OrderStatus.PAID
    run(body)
