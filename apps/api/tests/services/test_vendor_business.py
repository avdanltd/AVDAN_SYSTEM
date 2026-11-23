"""Branches: vendors asking to join a business, admin approval, and the grouped marketplace."""
import uuid

import pytest
from sqlalchemy import select

from core.exceptions import ValidationException
from services.auth.models import User
from services.notification.models import Notification
from services.vendor import business as biz
from services.vendor.models import Business, Product, Vendor
from services.vendor.service import VendorService
from tests.services.test_admin_attention import run


async def _vendor(db, name=None, status="active", **kw):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    owner = User(
        role="vendor", email=kw.pop("email", f"v{uid}@t.io"), phone=kw.pop("phone", None),
        password_hash="x", name=kw.pop("owner_name", f"Owner {uid}"), status="active",
    )
    db.add(owner)
    await db.flush()
    v = Vendor(user_id=owner.id, name=name or f"Shop {uid}", slug=f"shop-{uid}", status=status, **kw)
    db.add(v)
    await db.flush()
    return v


async def _admin(db):  # type: ignore[no-untyped-def]
    a = User(role="admin", email=f"a{uuid.uuid4().hex[:8]}@t.io", password_hash="x", name="Admin", status="active")
    db.add(a)
    await db.flush()
    return a


def test_request_rules() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        a, b = await _vendor(db), await _vendor(db)
        req = await biz.request_join(db, a, business_id=None, vendor_id=str(b.id), brand_name=None, note="same owner")
        assert req.status == "pending" and req.target_vendor_id == b.id

        with pytest.raises(ValidationException):  # one waiting request at a time
            await biz.request_join(db, a, business_id=None, vendor_id=None, brand_name="Other", note=None)
        c = await _vendor(db)
        with pytest.raises(ValidationException):  # must name exactly one target
            await biz.request_join(db, c, business_id=None, vendor_id=None, brand_name=None, note=None)
        with pytest.raises(ValidationException):
            await biz.request_join(db, c, business_id=None, vendor_id=str(c.id), brand_name=None, note=None)  # itself

        await biz.cancel_request(db, a)
        st = await biz.my_status(db, a)
        assert st["business"] is None and st["request"]["status"] == "cancelled"
    run(body)


def test_approving_a_vendor_target_creates_the_business_and_tells_everyone() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        admin = await _admin(db)
        ife, ikeja = await _vendor(db, "Bokku Mart Ife", state="Osun", city="Ife"), await _vendor(db, "Bokku Mart", state="Lagos", city="Ikeja")
        req = await biz.request_join(db, ife, business_id=None, vendor_id=str(ikeja.id), brand_name=None, note=None)

        business = await biz.approve_request(db, str(req.id), str(admin.id), "Bokku Mart")
        await db.refresh(ife)
        await db.refresh(ikeja)
        assert ife.business_id == ikeja.business_id == business.id and business.name == "Bokku Mart"
        assert req.status == "approved"
        mine = (await db.execute(select(Notification).where(Notification.user_id == ife.user_id, Notification.type == "branch_decision"))).scalars().all()
        others = (await db.execute(select(Notification).where(Notification.user_id == ikeja.user_id, Notification.type == "branch_joined"))).scalars().all()
        assert len(mine) == 1 and len(others) == 1  # no one is attached unnoticed

        with pytest.raises(ValidationException):  # can't approve twice
            await biz.approve_request(db, str(req.id), str(admin.id), None)
    run(body)


def test_approving_a_brand_name_request_and_an_existing_business() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        admin = await _admin(db)
        first = await _vendor(db, "Ife Branch")
        r1 = await biz.request_join(db, first, business_id=None, vendor_id=None, brand_name="Zeta Stores", note=None)
        zeta = await biz.approve_request(db, str(r1.id), str(admin.id), None)
        assert zeta.name == "Zeta Stores"

        second = await _vendor(db, "Ikeja Branch")
        r2 = await biz.request_join(db, second, business_id=str(zeta.id), vendor_id=None, brand_name=None, note=None)
        await biz.approve_request(db, str(r2.id), str(admin.id), None)
        await db.refresh(second)
        assert second.business_id == zeta.id
        assert len(await biz.branches_of(db, zeta.id)) == 2
    run(body)


def test_reject_needs_a_reason_and_leaving_removes_an_empty_business() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        admin = await _admin(db)
        a, b = await _vendor(db), await _vendor(db)
        req = await biz.request_join(db, a, business_id=None, vendor_id=str(b.id), brand_name=None, note=None)
        with pytest.raises(ValidationException):
            await biz.reject_request(db, str(req.id), str(admin.id), " ")
        await biz.reject_request(db, str(req.id), str(admin.id), "We could not verify you")
        st = await biz.my_status(db, a)
        assert st["request"]["status"] == "rejected" and st["request"]["reason"] == "We could not verify you"

        # a rejected vendor can ask again; then leaving the last branch removes the business
        req2 = await biz.request_join(db, a, business_id=None, vendor_id=None, brand_name="Solo Brand", note=None)
        biz_row = await biz.approve_request(db, str(req2.id), str(admin.id), None)
        await biz.leave(db, a)
        assert (await db.execute(select(Business).where(Business.id == biz_row.id))).scalar_one_or_none() is None
    run(body)


def test_evidence_points_out_matching_details() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        a = await _vendor(db, "20NINE SR", email="ada@twentynine.ng", owner_name="Ada Obi", payout_account_name="Ada Obi Stores")
        b = await _vendor(db, "20NINE STALLION RESOURCES", email="stallion@twentynine.ng", owner_name="Ada Obi", payout_account_name="ada obi stores")
        req = await biz.request_join(db, a, business_id=None, vendor_id=str(b.id), brand_name=None, note=None)
        text = " | ".join(await biz.evidence(db, req))
        assert "Same email domain" in text and "Same payout account holder" in text and "Same owner name" in text and "similar" in text
        stranger = await _vendor(db, "Totally Different Ltd")
        req2 = await biz.request_join(db, stranger, business_id=None, vendor_id=str(b.id), brand_name=None, note=None)
        assert "No matching details" in " ".join(await biz.evidence(db, req2))
    run(body)


def test_marketplace_shows_one_card_per_business_and_search_finds_all_branches() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        admin = await _admin(db)
        tag = uuid.uuid4().hex[:6]
        ife = await _vendor(db, f"Ife Outlet {tag}", state="Osun", city="Ife", rating=4, review_count=3)
        ikeja = await _vendor(db, f"Ikeja Outlet {tag}", state="Lagos", city="Ikeja", rating=5, review_count=1)
        solo = await _vendor(db, f"Solo {tag}")
        req = await biz.request_join(db, ife, business_id=None, vendor_id=str(ikeja.id), brand_name=None, note=None)
        business = await biz.approve_request(db, str(req.id), str(admin.id), f"Brand {tag}")

        svc = VendorService(db)
        flat, flat_total = await svc.list_vendors(None, 1, 500, search=tag)
        assert flat_total == 3  # every vendor, as before
        grouped, grouped_total = await svc.list_vendors(None, 1, 500, search=tag, group=True)
        assert grouped_total == 2 and len(grouped) == 2  # the brand once + the solo vendor
        # searching the BRAND name finds both branches although neither is named after it
        by_brand, n = await svc.list_vendors(None, 1, 500, search=f"Brand {tag}")
        assert n == 2

        info = await svc.business_info(grouped)
        assert info[business.id]["count"] == 2 and set(info[business.id]["places"]) == {"Ife, Osun", "Ikeja, Lagos"}
        assert solo.business_id is None

        db.add(Product(vendor_id=ife.id, name="p1", price_kobo=1, vendor_price_kobo=1, approval_status="APPROVED"))
        db.add(Product(vendor_id=ikeja.id, name="p2", price_kobo=1, vendor_price_kobo=1, approval_status="APPROVED"))
        db.add(Product(vendor_id=solo.id, name="p3", price_kobo=1, vendor_price_kobo=1, approval_status="APPROVED"))
        await db.flush()
        prods, pn = await svc.list_products(1, 50, business_slug=business.slug)
        assert pn == 2 and {p.name for p in prods} == {"p1", "p2"}

        _, branches = await svc.get_business_by_slug(business.slug)
        assert len(branches) == 2
    run(body)


def test_incomplete_filter_matches_the_checklist_and_counts_agree() -> None:
    from services.admin.service import AdminService

    async def body(db):  # type: ignore[no-untyped-def]
        bare = await _vendor(db, status="pending")  # nothing filled in
        full = await _vendor(
            db, phone="08099990000", state="Ogun", lga="Ota", city="Sango", street="1 Main St", lat=6.6, lng=3.2,
            description="Retail of groceries and appliances for homes.",
        )
        svc = AdminService(db)
        incomplete, n = await svc.list_vendors(None, 1, 500, incomplete=True)
        ids = {v.id for v in incomplete}
        assert bare.id in ids and full.id not in ids and n == len(incomplete)
        # the SQL filter and the Python checklist must agree, or the red numbers would lie
        for v in incomplete:
            assert [c for c in svc.vendor_checklist(v, None) if c["required"] and not c["ok"]]
        counts = await svc.vendor_counts()
        assert counts["incomplete"] == n and counts["all"] >= 2 and counts["pending"] >= 1
    run(body)
