"""
Wallet / payout-request tests — the money-moving paths.

Requires: postgres on localhost:5432 (avdan_test db) and redis (the shared conftest boots the app).
Run: uv run pytest tests/services/test_wallet.py -v
"""
import asyncio
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.exceptions import AppError
from services.auth.models import User
from services.dispatch.models import Rider
from services.orders.models import Order
from services.orders.service import OrderService
from services.orders.state_machine import OrderStatus
from services.qa.models import AgentHub
from services.vendor.models import Vendor
from services.wallet.models import PayoutStatus
from services.wallet.service import WalletService
from tests.conftest import TEST_DATABASE_URL


def run(coro_fn):  # type: ignore[no-untyped-def]
    """Run an async test body against a fresh engine; commits are real, rows use unique ids."""
    async def _go():  # type: ignore[no-untyped-def]
        engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                await coro_fn(db)
                await db.rollback()  # leave nothing behind
        finally:
            await engine.dispose()
    asyncio.run(_go())


class FakeProvider:
    def __init__(self, status: str = "pending") -> None:
        self.status = status
        self.calls: list[tuple[str, int, str]] = []

    async def transfer_to_vendor(self, recipient: str, amount: int, ref: str):  # type: ignore[no-untyped-def]
        self.calls.append((recipient, amount, ref))
        return SimpleNamespace(status=self.status, transfer_ref=ref)


@pytest.fixture
def fake_provider(monkeypatch):  # type: ignore[no-untyped-def]
    provider = FakeProvider()
    monkeypatch.setattr("services.payment.providers.registry.get_provider", lambda _name: provider)
    return provider


async def _seed(db, *, delivered_kobo: int = 1_000_000):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    vendor_user = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="Vend", status="active")
    rider_user = User(role="rider", email=f"r{uid}@t.io", password_hash="x", name="Ride", status="active")
    admin_user = User(role="admin", email=f"a{uid}@t.io", password_hash="x", name="Adm", status="active")
    cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="Cust", status="active")
    db.add_all([vendor_user, rider_user, admin_user, cust])
    await db.flush()
    vendor = Vendor(user_id=vendor_user.id, name=f"V{uid}", slug=f"v-{uid}", status="active",
                    lat=6.5, lng=3.3, paystack_recipient_code="RCP_v", payout_account_number="0123456789",
                    payout_bank_name="Bank", payout_account_name="Vend Ltd")
    rider = Rider(user_id=rider_user.id, paystack_recipient_code="RCP_r", payout_account_number="9876543210",
                  payout_bank_name="Bank", payout_account_name="Ride")
    db.add_all([vendor, rider])
    await db.flush()
    order = Order(customer_id=cust.id, vendor_id=vendor.id, rider_id=rider.id, status=OrderStatus.DELIVERED,
                  total_kobo=delivered_kobo, delivery_fee_kobo=80_000, delivery_address={"street": "s"})
    db.add(order)
    await db.flush()
    return SimpleNamespace(vendor_user=vendor_user, rider_user=rider_user, admin=admin_user,
                           vendor=vendor, rider=rider, order=order)


def test_vendor_credit_is_net_of_commission_and_idempotent() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        svc = WalletService(db)
        net = await svc.credit_vendor_for_order(s.order)
        assert net == 900_000  # 10% default commission on 1,000,000
        assert await svc.credit_vendor_for_order(s.order) == 900_000  # retry: no second entry
        summary = await svc.my_summary("vendor", str(s.vendor_user.id))
        assert summary["available_kobo"] == 900_000
        assert summary["lifetime_earned_kobo"] == 900_000
    run(body)


def test_rider_credit_is_full_delivery_fee_on_legacy_orders() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        svc = WalletService(db)
        await svc.credit_rider_for_order(s.order)
        await svc.credit_rider_for_order(s.order)
        summary = await svc.my_summary("rider", str(s.rider_user.id))
        assert summary["available_kobo"] == 80_000
    run(body)


def test_rider_credit_is_net_of_delivery_commission() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        s.order.rider_fee_kobo = 64_000  # 20% of the 80,000 fee kept by AVDAN
        svc = WalletService(db)
        assert await svc.credit_rider_for_order(s.order) == 64_000
        await svc.credit_rider_for_order(s.order)  # retry: no second entry
        summary = await svc.my_summary("rider", str(s.rider_user.id))
        assert summary["available_kobo"] == 64_000
    run(body)


def test_request_validation() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        svc = WalletService(db)
        await svc.credit_vendor_for_order(s.order)
        uid = str(s.vendor_user.id)
        with pytest.raises(AppError) as low:
            await svc.request_withdrawal("vendor", uid, 50_000)  # below ₦1,000 minimum
        assert low.value.code == "BELOW_MINIMUM_WITHDRAWAL"
        with pytest.raises(AppError) as high:
            await svc.request_withdrawal("vendor", uid, 900_001)
        assert high.value.code == "INSUFFICIENT_AVAILABLE_BALANCE"
        s.vendor.paystack_recipient_code = None
        with pytest.raises(AppError) as noacct:
            await svc.request_withdrawal("vendor", uid, 200_000)
        assert noacct.value.code == "PAYOUT_ACCOUNT_NOT_SET"
    run(body)


def test_full_lifecycle_partial_approval_then_webhook_success(fake_provider) -> None:  # type: ignore[no-untyped-def]
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        svc = WalletService(db)
        await svc.credit_vendor_for_order(s.order)  # available 900,000
        uid = str(s.vendor_user.id)

        req = await svc.request_withdrawal("vendor", uid, 600_000)
        summary = await svc.my_summary("vendor", uid)
        assert (summary["available_kobo"], summary["requested_kobo"], summary["paid_out_kobo"]) == (300_000, 600_000, 0)

        # Admin approves less than requested: the 100,000 difference returns to Available.
        req = await svc.approve(str(req.id), str(s.admin.id), 500_000, "partial")
        assert req.status == PayoutStatus.PROCESSING
        assert fake_provider.calls == [("RCP_v", 500_000, f"wd-{req.id}")]
        summary = await svc.my_summary("vendor", uid)
        assert (summary["available_kobo"], summary["requested_kobo"], summary["paid_out_kobo"]) == (400_000, 500_000, 0)

        # Approving twice must not send money twice.
        with pytest.raises(AppError) as again:
            await svc.approve(str(req.id), str(s.admin.id), 500_000, None)
        assert again.value.code == "PAYOUT_NOT_PENDING"
        assert len(fake_provider.calls) == 1

        await svc.handle_transfer_webhook("transfer.success", f"wd-{req.id}")
        await svc.handle_transfer_webhook("transfer.success", f"wd-{req.id}")  # duplicate delivery
        summary = await svc.my_summary("vendor", uid)
        assert (summary["available_kobo"], summary["requested_kobo"], summary["paid_out_kobo"]) == (400_000, 0, 500_000)

        _, events, _ = await svc.admin_get_request(str(req.id))
        assert [e.event for e in events] == ["REQUESTED", "APPROVED", "TRANSFER_SUCCESS"]
    run(body)


def test_failed_transfer_returns_money_to_available(fake_provider) -> None:  # type: ignore[no-untyped-def]
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        svc = WalletService(db)
        await svc.credit_rider_for_order(s.order)
        uid = str(s.rider_user.id)
        # Fee (80,000) is below the default minimum, so lower it for this scenario.
        from services.analytics.service import AnalyticsService
        await AnalyticsService(db).update_config({"min_withdrawal_kobo": 10_000}, str(s.admin.id))
        req = await svc.request_withdrawal("rider", uid, 80_000)
        await svc.approve(str(req.id), str(s.admin.id), 80_000, None)
        await svc.handle_transfer_webhook("transfer.failed", f"wd-{req.id}")
        summary = await svc.my_summary("rider", uid)
        assert (summary["available_kobo"], summary["requested_kobo"], summary["paid_out_kobo"]) == (80_000, 0, 0)
        assert (await svc.admin_get_request(str(req.id)))[0].status == PayoutStatus.FAILED
    run(body)


def test_reject_releases_hold_and_requires_decision_once(fake_provider) -> None:  # type: ignore[no-untyped-def]
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        svc = WalletService(db)
        await svc.credit_vendor_for_order(s.order)
        uid = str(s.vendor_user.id)
        req = await svc.request_withdrawal("vendor", uid, 300_000)
        await svc.reject(str(req.id), str(s.admin.id), "Details do not match")
        summary = await svc.my_summary("vendor", uid)
        assert (summary["available_kobo"], summary["requested_kobo"]) == (900_000, 0)
        with pytest.raises(AppError):
            await svc.approve(str(req.id), str(s.admin.id), 300_000, None)
        assert fake_provider.calls == []  # nothing ever sent
    run(body)


def test_delivery_quote_prices_vendor_to_hub_to_customer() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        hub = AgentHub(name="Hub", lat=6.6, lng=3.3, capacity=100, active=True)
        db.add(hub)
        await db.flush()
        svc = OrderService(db)
        # customer 0.2° north of the hub (~22 km straight line), vendor 0.1° south of the hub
        quote = await svc.quote_delivery(s.vendor, {"lat": 6.8, "lng": 3.3})
        assert quote["method"] == "via_hub"
        assert quote["vendor_to_hub_km"] > 0 and quote["hub_to_customer_km"] > quote["vendor_to_hub_km"]
        expected = 50_000 + int(10_000 * quote["total_km"])
        assert quote["fee_kobo"] == expected
        # No customer coordinates -> flat base fee, never an error.
        flat = await svc.quote_delivery(s.vendor, {})
        assert flat["method"] == "flat" and flat["fee_kobo"] == 50_000
    run(body)
