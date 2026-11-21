"""Order numbers for the admin Orders page: counts per status group, value, time series, and the
search / date filters the list always advertised but silently ignored."""
import uuid
from datetime import UTC, date, datetime, timedelta

from services.admin.service import AdminService
from services.auth.models import User
from services.orders.models import Order
from services.vendor.models import Vendor
from tests.services.test_admin_attention import run


async def _party(db):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="C", status="active")
    vu = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
    db.add_all([cust, vu])
    await db.flush()
    vendor = Vendor(user_id=vu.id, name=f"V{uid}", slug=f"v-{uid}", status="approved")
    db.add(vendor)
    await db.flush()
    return cust, vendor


async def _order(db, cust, vendor, status, created):  # type: ignore[no-untyped-def]
    o = Order(customer_id=cust.id, vendor_id=vendor.id, status=status, total_kobo=1000,
              delivery_fee_kobo=500, delivery_address={"street": "s"})
    o.created_at = created
    db.add(o)
    await db.flush()
    return o


def test_order_stats_by_group_value_and_series() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, vendor = await _party(db)
        base = datetime(2032, 5, 10, 12, 0, tzinfo=UTC)  # far from any other test's data
        await _order(db, cust, vendor, "PENDING", base)
        await _order(db, cust, vendor, "PAID", base)
        await _order(db, cust, vendor, "OUT_FOR_DELIVERY", base + timedelta(days=1))
        await _order(db, cust, vendor, "PAYMENT_RELEASE_PENDING", base + timedelta(days=1))
        await _order(db, cust, vendor, "COMPLETED", base + timedelta(days=3))
        await _order(db, cust, vendor, "CANCELLED", base + timedelta(days=3))
        await _order(db, cust, vendor, "COMPLETED", base + timedelta(days=40))  # outside

        svc = AdminService(db)
        res = await svc.order_stats(date(2032, 5, 10), date(2032, 5, 16), None, None)
        counts = {g["key"]: g["count"] for g in res["groups"]}
        assert counts == {"pending": 1, "in_progress": 2, "delivered": 0, "release_pending": 1,
                          "completed": 1, "cancelled": 1, "issues": 0}
        assert res["total"] == 6
        # Pending + cancelled never became money: 4 paid orders x (1000 + 500).
        assert res["value_kobo"] == 4 * 1500
        assert res["bucket"] == "day" and len(res["series"]) == 7
        assert [p["total"] for p in res["series"]] == [2, 2, 0, 2, 0, 0, 0]
        assert res["series"][3]["by_group"] == {"completed": 1, "cancelled": 1}

        # Selecting a group narrows the total and chart but not the chip counts.
        only = await svc.order_stats(date(2032, 5, 10), date(2032, 5, 16), "completed", None)
        assert only["total"] == 1 and sum(p["total"] for p in only["series"]) == 1
        assert {g["key"]: g["count"] for g in only["groups"]} == counts
    run(body)


def test_order_list_honours_search_and_dates() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, vendor = await _party(db)
        base = datetime(2033, 2, 10, 12, 0, tzinfo=UTC)
        a = await _order(db, cust, vendor, "PAID", base)
        await _order(db, cust, vendor, "PAID", base + timedelta(days=5))

        svc = AdminService(db)
        _, total = await svc.list_orders(None, None, None, 1, 50, date_from=date(2033, 2, 10), date_to=date(2033, 2, 12))
        assert total == 1
        found, total = await svc.list_orders(None, None, None, 1, 50, search=str(a.id)[:10])
        assert total == 1 and found[0].id == a.id
        _, total = await svc.list_orders(None, None, None, 1, 50, search="%")  # wildcard is literal
        assert total == 0
    run(body)


def test_vendor_scoped_stats_only_count_that_vendors_orders_at_their_price() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        cust, mine = await _party(db)
        _, other = await _party(db)
        base = datetime(2034, 6, 10, 12, 0, tzinfo=UTC)
        a = await _order(db, cust, mine, "COMPLETED", base)
        a.vendor_total_kobo = 800  # what the vendor earns; the customer paid 1000 + 500 delivery
        await _order(db, cust, mine, "PAID", base)  # vendor_total_kobo null -> falls back to total
        await _order(db, cust, other, "COMPLETED", base)  # someone else's: must not count

        res = await AdminService(db).order_stats(
            date(2034, 6, 10), date(2034, 6, 10), None, None, vendor_id=mine.id
        )
        assert res["total"] == 2
        assert res["value_kobo"] == 800 + 1000
        counts = {g["key"]: g["count"] for g in res["groups"]}
        assert counts["completed"] == 1 and counts["in_progress"] == 1
    run(body)


def test_product_vendor_summaries_count_by_status_and_put_pending_first() -> None:
    from services.vendor.models import Product

    async def body(db):  # type: ignore[no-untyped-def]
        _, quiet = await _party(db)
        _, busy = await _party(db)
        for status in ("APPROVED", "APPROVED", "REJECTED"):
            db.add(Product(vendor_id=quiet.id, name="q", price_kobo=1, vendor_price_kobo=1, approval_status=status))
        for status in ("PENDING", "PENDING", "APPROVED"):
            db.add(Product(vendor_id=busy.id, name="b", price_kobo=1, vendor_price_kobo=1, approval_status=status))
        await db.flush()
        rows, total = await AdminService(db).product_vendor_summaries(None, 1, 500)
        by_id = {r["vendor_id"]: r for r in rows}
        assert (by_id[str(busy.id)]["total"], by_id[str(busy.id)]["live"], by_id[str(busy.id)]["pending"]) == (3, 1, 2)
        assert (by_id[str(quiet.id)]["live"], by_id[str(quiet.id)]["rejected"], by_id[str(quiet.id)]["pending"]) == (2, 1, 0)
        order = [r["vendor_id"] for r in rows]
        assert order.index(str(busy.id)) < order.index(str(quiet.id))  # waiting work first
        only, n = await AdminService(db).product_vendor_summaries(busy.name, 1, 20)
        assert n == 1 and only[0]["vendor_id"] == str(busy.id)
    run(body)
