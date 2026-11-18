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
