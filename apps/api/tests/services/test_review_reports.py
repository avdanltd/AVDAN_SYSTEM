"""Reporting a review: one report per person, not your own, and moderators see and clear them."""
import uuid

import pytest

from core.exceptions import ValidationException
from services.review.models import Review, ReviewReport
from services.review.service import ReviewService
from tests.services.test_account_deletion import _order, _user, _vendor
from tests.services.test_admin_attention import run


async def _review(db):  # type: ignore[no-untyped-def]
    customer = await _user(db, "customer")
    _, vendor = await _vendor(db)
    order = await _order(db, customer, vendor, "COMPLETED")
    r = Review(customer_id=customer.id, order_id=order.id, vendor_id=vendor.id, target_type="vendor", rating=1,
               comment="awful", order_outcome="COMPLETED", status="visible")
    db.add(r)
    await db.flush()
    return customer, r


def test_report_once_not_own_and_moderator_view() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        author, review = await _review(db)
        other = await _user(db, "customer")
        svc = ReviewService(db)

        with pytest.raises(ValidationException):
            await svc.report(str(review.id), str(author.id), "spam", None)  # own review
        await svc.report(str(review.id), str(other.id), "offensive", "abusive words")
        with pytest.raises(ValidationException):
            await svc.report(str(review.id), str(other.id), "spam", None)  # twice

        rows = await svc.admin_list(None, None, None, 1, 50, reported=True)
        mine = next(r for r in rows["items"] if r["id"] == str(review.id))
        assert mine["report_count"] == 1 and mine["report_reasons"] == ["offensive"]
        assert mine["customer_name"]

        await svc.dismiss_reports(str(review.id), str(other.id))
        assert str(review.id) not in {r["id"] for r in (await svc.admin_list(None, None, None, 1, 50, reported=True))["items"]}
    run(body)


def test_hiding_a_review_marks_its_reports_actioned() -> None:
    from sqlalchemy import select

    async def body(db):  # type: ignore[no-untyped-def]
        _, review = await _review(db)
        reporter = await _user(db, "customer")
        admin = await _user(db, "admin")
        svc = ReviewService(db)
        await svc.report(str(review.id), str(reporter.id), "false", None)
        await svc.hide(str(review.id), str(admin.id), "fake review")
        status = (await db.execute(select(ReviewReport.status).where(ReviewReport.review_id == review.id))).scalar_one()
        assert status == "actioned"
    run(body)
