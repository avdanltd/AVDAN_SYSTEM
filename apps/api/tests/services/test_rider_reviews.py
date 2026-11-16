"""Customers can rate the rider who delivered their order; the rider's average follows."""
import uuid

import pytest

from core.exceptions import AppError
from services.auth.models import User
from services.dispatch.models import Rider
from services.orders.models import Order
from services.orders.state_machine import OrderStatus
from services.review.schemas import ReviewInput, SubmitReviewsRequest
from services.review.service import ReviewService
from services.vendor.models import Vendor
from tests.services.test_admin_attention import run


async def _order(db, status, with_rider=True):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="Cee Dee", status="active")
    vu = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
    ru = User(role="rider", email=f"r{uid}@t.io", password_hash="x", name="Rider Ray", status="active")
    db.add_all([cust, vu, ru])
    await db.flush()
    vendor = Vendor(user_id=vu.id, name=f"Shop{uid}", slug=f"s-{uid}", status="approved")
    rider = Rider(user_id=ru.id)
    db.add_all([vendor, rider])
    await db.flush()
    order = Order(customer_id=cust.id, vendor_id=vendor.id, status=status, total_kobo=1000,
                  delivery_fee_kobo=500, delivery_address={"street": "s"},
                  rider_id=rider.id if with_rider else None)
    db.add(order)
    await db.flush()
    # ReviewService treats an order as reviewable only if it was paid at some point.
    from services.orders.models import OrderEvent
    db.add(OrderEvent(order_id=order.id, from_state="PENDING", to_state=OrderStatus.PAID, actor_role="system"))
    await db.flush()
    return cust, rider, order


def test_rider_rating_saved_and_average_updates() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, rider, order = await _order(db, OrderStatus.COMPLETED)
        cid, oid, rid = str(cust.id), str(order.id), rider.id
        svc = ReviewService(db)
        before = await svc.get_order_reviews(oid, cid)
        assert before["rider_reviewable"] and before["rider_name"] == "Rider Ray" and before["rider"] is None

        after = await svc.submit(oid, cid, SubmitReviewsRequest(rider=ReviewInput(rating=4, comment="Quick")))
        assert after["rider"]["rating"] == 4
        await db.refresh(rider)
        assert float(rider.rating) == 4.0 and rider.review_count == 1
        assert rid == rider.id

        with pytest.raises(AppError):  # one rider rating per order
            await svc.submit(oid, cid, SubmitReviewsRequest(rider=ReviewInput(rating=5)))
    run(body)


def test_rider_not_reviewable_without_a_delivery() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, _, cancelled = await _order(db, OrderStatus.CANCELLED)
        cid, oid = str(cust.id), str(cancelled.id)
        svc = ReviewService(db)
        assert (await svc.get_order_reviews(oid, cid))["rider_reviewable"] is False
        with pytest.raises(AppError):
            await svc.submit(oid, cid, SubmitReviewsRequest(rider=ReviewInput(rating=5)))

        cust2, _, no_rider = await _order(db, OrderStatus.COMPLETED, with_rider=False)
        with pytest.raises(AppError):
            await svc.submit(str(no_rider.id), str(cust2.id), SubmitReviewsRequest(rider=ReviewInput(rating=5)))
    run(body)
