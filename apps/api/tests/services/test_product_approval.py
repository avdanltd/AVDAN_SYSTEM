"""Product approval: the shown price can't undercut the vendor, and vendors are paid their own price."""
import asyncio
import uuid
from types import SimpleNamespace

import pytest

from core.exceptions import ValidationException
from services.admin.service import AdminService
from services.wallet.service import WalletService


def run(coro):
    return asyncio.run(coro)


def _admin_with(product) -> AdminService:
    svc = AdminService(None)  # type: ignore[arg-type]

    async def _get(_id):
        return product

    svc._get_product = _get  # type: ignore[method-assign]
    return svc


def _product(**kw):
    return SimpleNamespace(
        vendor_price_kobo=100_000, price_kobo=100_000, approval_status="PENDING", rejection_reason=None, **kw
    )


def test_approve_sets_shown_price_and_goes_live():
    p = _product()
    run(_admin_with(p).approve_product("x", 125_000))
    assert (p.price_kobo, p.approval_status) == (125_000, "APPROVED")


def test_shown_price_below_vendor_price_is_refused():
    p = _product()
    with pytest.raises(ValidationException):
        run(_admin_with(p).approve_product("x", 99_999))
    assert p.approval_status == "PENDING"


def test_reject_records_reason():
    p = _product()
    run(_admin_with(p).reject_product("x", "Photo is blurry"))
    assert (p.approval_status, p.rejection_reason) == ("REJECTED", "Photo is blurry")


def _wallet_capturing():
    svc = WalletService(None)  # type: ignore[arg-type]
    credits: list = []

    async def _credit(owner_type, owner_id, order_id, amount, meta):
        credits.append((amount, meta))
        return True

    svc._credit = _credit  # type: ignore[method-assign]
    return svc, credits


def test_vendor_is_credited_their_own_price_not_the_marked_up_total():
    svc, credits = _wallet_capturing()
    order = SimpleNamespace(id=uuid.uuid4(), vendor_id=uuid.uuid4(), total_kobo=125_000, vendor_total_kobo=100_000)
    assert run(svc.credit_vendor_for_order(order)) == 100_000
    assert credits[0][1]["commission_kobo"] == 25_000  # the markup is the platform's gain


def _discount_product():
    return SimpleNamespace(
        vendor_price_kobo=100_000, price_kobo=100_000, approval_status="PENDING", rejection_reason=None,
        compare_at_price_kobo=None, discount_type=None, discount_value=None,
    )


def test_percent_discount_sets_final_price_and_keeps_original():
    p = _discount_product()
    run(_admin_with(p).approve_product("x", 150_000, "PERCENT", 20))
    assert (p.price_kobo, p.compare_at_price_kobo) == (120_000, 150_000)


def test_fixed_discount_down_to_the_vendor_price_is_allowed():
    p = _discount_product()
    run(_admin_with(p).approve_product("x", 150_000, "FIXED", 50_000))
    assert p.price_kobo == 100_000


def test_discount_below_vendor_price_is_refused():
    p = _discount_product()
    with pytest.raises(ValidationException, match="below the vendor's price"):
        run(_admin_with(p).approve_product("x", 150_000, "FIXED", 50_001))
    assert p.approval_status == "PENDING"


def test_no_discount_clears_a_previous_one():
    p = _discount_product()
    p.compare_at_price_kobo, p.discount_type, p.discount_value = 150_000, "PERCENT", 20
    run(_admin_with(p).approve_product("x", 150_000))
    assert (p.price_kobo, p.compare_at_price_kobo, p.discount_type) == (150_000, None, None)
