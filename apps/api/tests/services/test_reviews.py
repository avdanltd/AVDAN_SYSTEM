"""Reviews & ratings — eligibility, one-review-per-item, averages, moderation.

Requires postgres (avdan_test) like the other DB tests. Run: uv run pytest tests/services/test_reviews.py -v
"""
import asyncio
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.exceptions import AppError
from services.auth.models import User
from services.orders.models import Order, OrderEvent, OrderItem
from services.orders.state_machine import OrderStatus
from services.review.schemas import ProductReviewInput, ReviewInput, SubmitReviewsRequest
from services.review.service import ReviewService, reviewer_label
from services.vendor.models import Product, Vendor
from tests.conftest import TEST_DATABASE_URL


def run(coro_fn):  # type: ignore[no-untyped-def]
    async def _go():  # type: ignore[no-untyped-def]
        engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as db:
                await coro_fn(db)
                await db.rollback()
        finally:
            await engine.dispose()
    asyncio.run(_go())


async def _seed(db, *, status=OrderStatus.COMPLETED, paid=True, n_products=2):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    users = {r: User(role=r, email=f"{r}{uid}@t.io", password_hash="x", name=n, status="active")
             for r, n in (("customer", "Ada Obi"), ("vendor", "Vee"), ("admin", "Adm"), ("other", "Zed Z"))}
    users["other"].role = "customer"
    db.add_all(users.values())
    await db.flush()
    vendor = Vendor(user_id=users["vendor"].id, name=f"V{uid}", slug=f"v-{uid}", status="active")
    db.add(vendor)
    await db.flush()
    products = [Product(vendor_id=vendor.id, name=f"P{i}{uid}", price_kobo=1000, vendor_price_kobo=1000,
                        approval_status="APPROVED", available=True, stock_qty=5) for i in range(n_products)]
    db.add_all(products)
    await db.flush()
    order = Order(customer_id=users["customer"].id, vendor_id=vendor.id, status=status, total_kobo=2000,
                  delivery_address={"street": "s"})
    db.add(order)
    await db.flush()
    db.add_all([OrderItem(order_id=order.id, product_id=p.id, product_name=p.name, price_kobo=1000,
                          quantity=1, subtotal_kobo=1000) for p in products])
    if paid:
        db.add(OrderEvent(order_id=order.id, from_state="PENDING", to_state=OrderStatus.PAID, actor_role="system"))
    await db.flush()
    return SimpleNamespace(users=users, vendor=vendor, products=products, order=order)


def _both(s, product_rating=5, vendor_rating=4):  # type: ignore[no-untyped-def]
    return SubmitReviewsRequest(
        vendor=ReviewInput(rating=vendor_rating, comment="  Fast delivery  "),
        products=[ProductReviewInput(product_id=str(p.id), rating=product_rating) for p in s.products],
    )


def test_reviewer_label_never_shows_a_full_name() -> None:
    assert reviewer_label("Ada Obi") == "Ada O."
    assert reviewer_label("Ada") == "Ada" and reviewer_label(None) == "Customer" and reviewer_label("  ") == "Customer"


def test_customer_reviews_completed_order_once_and_averages_update() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        svc = ReviewService(db)
        cid = str(s.users["customer"].id)
        before = await svc.get_order_reviews(str(s.order.id), cid)
        assert before["eligible"] and before["vendor"] is None and len(before["products"]) == 2

        after = await svc.submit(str(s.order.id), cid, _both(s))
        assert after["vendor"]["comment"] == "Fast delivery" and after["vendor"]["reviewer_name"] == "Ada O."
        assert all(p["review"]["rating"] == 5 for p in after["products"])
        assert float(s.vendor.rating) == 4.0 and s.vendor.review_count == 1
        assert float(s.products[0].rating) == 5.0 and s.products[0].review_count == 1

        with pytest.raises(AppError) as again:
            await svc.submit(str(s.order.id), cid, _both(s))
        assert again.value.code == "ALREADY_REVIEWED"
    run(body)


@pytest.mark.parametrize("status", [OrderStatus.CANCELLED, OrderStatus.REFUND_INITIATED,
                                    OrderStatus.VENDOR_REJECTED, OrderStatus.DELIVERED])
def test_ended_orders_can_be_reviewed_either_way(status) -> None:  # type: ignore[no-untyped-def]
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db, status=status)
        out = await ReviewService(db).submit(str(s.order.id), str(s.users["customer"].id), _both(s))
        assert out["eligible"] and out["vendor"] is not None
    run(body)


def test_in_flight_unpaid_and_foreign_orders_cannot_be_reviewed() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        svc = ReviewService(db)
        s = await _seed(db, status=OrderStatus.OUT_FOR_DELIVERY)
        with pytest.raises(AppError) as e1:
            await svc.submit(str(s.order.id), str(s.users["customer"].id), _both(s))
        assert e1.value.code == "ORDER_NOT_REVIEWABLE"

        unpaid = await _seed(db, status=OrderStatus.CANCELLED, paid=False)
        with pytest.raises(AppError) as e2:
            await svc.submit(str(unpaid.order.id), str(unpaid.users["customer"].id), _both(unpaid))
        assert e2.value.code == "ORDER_NOT_REVIEWABLE" and "never paid" in e2.value.message

        done = await _seed(db)
        with pytest.raises(Exception) as e3:  # someone else's order looks like it doesn't exist
            await svc.submit(str(done.order.id), str(done.users["other"].id), _both(done))
        assert "not found" in str(e3.value).lower()
    run(body)


def test_validation_empty_foreign_product_and_duplicates() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db)
        other = await _seed(db)
        svc, cid, oid = ReviewService(db), str(s.users["customer"].id), str(s.order.id)
        with pytest.raises(AppError) as empty:
            await svc.submit(oid, cid, SubmitReviewsRequest())
        assert empty.value.code == "NOTHING_TO_REVIEW"
        with pytest.raises(AppError) as foreign:
            await svc.submit(oid, cid, SubmitReviewsRequest(
                products=[ProductReviewInput(product_id=str(other.products[0].id), rating=3)]))
        assert foreign.value.code == "PRODUCT_NOT_IN_ORDER"
        dup = ProductReviewInput(product_id=str(s.products[0].id), rating=3)
        with pytest.raises(AppError) as twice:
            await svc.submit(oid, cid, SubmitReviewsRequest(products=[dup, dup]))
        assert twice.value.code == "DUPLICATE_REVIEW"
    run(body)


def test_public_lists_summary_and_admin_hide_drops_the_average() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        s = await _seed(db, n_products=1)
        svc = ReviewService(db)
        await svc.submit(str(s.order.id), str(s.users["customer"].id), _both(s, product_rating=2, vendor_rating=5))
        page = await svc.list_product_reviews(str(s.products[0].id), 1, 10)
        assert page["summary"]["count"] == 1 and page["summary"]["average"] == 2.0
        assert page["summary"]["distribution"]["2"] == 1 and page["items"][0]["reviewer_name"] == "Ada O."

        listed = await svc.admin_list("visible", "product", None, 1, 20)
        review_id = next(i["id"] for i in listed["items"] if i["product_name"] == s.products[0].name)
        await svc.hide(review_id, str(s.users["admin"].id), "Spam")
        assert (await svc.list_product_reviews(str(s.products[0].id), 1, 10))["summary"]["count"] == 0
        assert s.products[0].review_count == 0 and float(s.products[0].rating) == 0.0
        hidden = await svc.admin_list("hidden", None, None, 1, 20)
        row = next(i for i in hidden["items"] if i["id"] == review_id)
        assert row["hidden_reason"] == "Spam" and row["hidden_by_name"] == "Adm" and row["order_outcome"] == "COMPLETED"

        await svc.unhide(review_id, str(s.users["admin"].id))
        assert s.products[0].review_count == 1 and float(s.products[0].rating) == 2.0
        assert float((await svc.list_vendor_reviews(str(s.vendor.id), 1, 10))["summary"]["average"]) == 5.0
    run(body)
