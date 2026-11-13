"""Admin status override must return a fully loaded order (it used to 500 on a lazy `items` load)."""
import uuid

from services.admin.service import AdminService
from services.auth.models import User
from services.orders.models import Order, OrderItem
from services.orders.state_machine import OrderStatus
from services.vendor.models import Product, Vendor
from tests.services.test_admin_attention import run


def test_override_returns_order_with_items_loaded() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        uid = uuid.uuid4().hex[:8]
        admin = User(role="admin", email=f"a{uid}@t.io", password_hash="x", name="A", status="active")
        cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="C", status="active")
        vu = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
        db.add_all([admin, cust, vu])
        await db.flush()
        vendor = Vendor(user_id=vu.id, name=f"V{uid}", slug=f"v-{uid}", status="approved")
        db.add(vendor)
        await db.flush()
        order = Order(customer_id=cust.id, vendor_id=vendor.id, status=OrderStatus.PAID,
                      total_kobo=1000, delivery_fee_kobo=500, delivery_address={"street": "s"})
        db.add(order)
        await db.flush()
        product = Product(vendor_id=vendor.id, name=f"P{uid}", price_kobo=1000, vendor_price_kobo=1000)
        db.add(product)
        await db.flush()
        db.add(OrderItem(order_id=order.id, product_id=product.id, product_name="P",
                         price_kobo=1000, quantity=1, subtotal_kobo=1000))
        await db.flush()
        order_id, admin_id = str(order.id), str(admin.id)
        db.expire_all()  # as in production, where the order is not already in the session

        result = await AdminService(db).override_order_status(
            order_id, "CANCELLED", "test", admin_id
        )
        assert result.status == "CANCELLED"
        # Reading items / updated_at here must not trigger any lazy load.
        assert len(result.items) == 1
        assert result.updated_at is not None
    run(body)
