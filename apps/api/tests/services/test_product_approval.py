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
