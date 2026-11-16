"""Unpaid orders stay cancellable (no time window); delivered-but-unreviewed orders are listed."""
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from core.exceptions import AppError
from services.auth.models import User
from services.orders.models import Order
from services.orders.service import OrderService
from services.orders.state_machine import OrderStatus
from services.payment.models import EscrowStatus, EscrowTransaction
from services.payment.service import PaymentService
from services.review.service import ReviewService
from services.vendor.models import Vendor
from tests.services.test_admin_attention import run


async def _setup(db, status):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="C", status="active")
    vu = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
    db.add_all([cust, vu])
    await db.flush()
    vendor = Vendor(user_id=vu.id, name=f"Shop{uid}", slug=f"s-{uid}", status="approved")
    db.add(vendor)
    await db.flush()
    order = Order(customer_id=cust.id, vendor_id=vendor.id, status=status, total_kobo=1000,
                  delivery_fee_kobo=500, delivery_address={"street": "s"})
    db.add(order)
    await db.flush()
    return cust, order


def test_old_pending_order_can_still_be_cancelled() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, order = await _setup(db, OrderStatus.PENDING)
        # Far older than any cancellation window.
        order.created_at = datetime.now(UTC) - timedelta(days=30)
        await db.flush()
        oid, cid = str(order.id), str(cust.id)
        result = await OrderService(db).cancel_order(cid, oid)
        assert result.status == OrderStatus.CANCELLED
    run(body)


def test_paid_order_cannot_be_cancelled_here() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, order = await _setup(db, OrderStatus.PAID)
        oid, cid = str(order.id), str(cust.id)
        with pytest.raises(AppError):
            await OrderService(db).cancel_order(cid, oid)
    run(body)


def test_several_payment_attempts_do_not_break_escrow_lookup() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        _, order = await _setup(db, OrderStatus.PENDING)
        for i in range(3):
            db.add(EscrowTransaction(order_id=order.id, provider="paystack",
                                     provider_ref=f"ref-{uuid.uuid4().hex}-{i}", amount_kobo=1500,
                                     status=EscrowStatus.INITIATED))
            await db.flush()
        escrow = await PaymentService(db)._get_escrow_for_order(str(order.id))
        assert escrow is not None
    run(body)


def test_pending_reviews_lists_delivered_unreviewed_only() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, delivered = await _setup(db, OrderStatus.COMPLETED)
        _, other = await _setup(db, OrderStatus.CANCELLED)
        rows = await ReviewService(db).pending_reviews(str(cust.id))
        assert [r["order_id"] for r in rows] == [str(delivered.id)]
        assert rows[0]["vendor_name"].startswith("Shop")
        assert str(other.id) not in [r["order_id"] for r in rows]
    run(body)
