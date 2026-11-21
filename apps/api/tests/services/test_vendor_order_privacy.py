"""Vendors see the customer's name and the order ID, nothing else about the customer."""
import uuid

from services.auth.models import User
from services.orders.models import Order
from services.orders.router import _order_detail_resp, _order_resp
from services.orders.state_machine import OrderStatus


def _order() -> Order:
    return Order(
        id=uuid.uuid4(), customer_id=uuid.uuid4(), vendor_id=uuid.uuid4(), status=OrderStatus.PAID,
        total_kobo=1000, delivery_fee_kobo=500,
        delivery_address={"street": "7 Alishiba St", "city": "Sango Ota", "state": "Ogun", "lat": 6.7, "lng": 3.2},
        delivery_quote={"legs": [{"to": {"lat": 6.7, "lng": 3.2}}]},
        items=[], events=[],
        created_at=__import__("datetime").datetime(2026, 1, 1), updated_at=__import__("datetime").datetime(2026, 1, 1),
    )


def test_vendor_view_hides_everything_but_the_customer_name() -> None:
    o = _order()
    for resp in (
        _order_resp(o, vendor_view=True, customer_name="Ada Obi"),
        _order_detail_resp(o, vendor_view=True, customer_name="Ada Obi"),
    ):
        data = resp.model_dump()
        assert data["customer_name"] == "Ada Obi"
        assert data["delivery_address"] == {} and data["delivery_quote"] is None
        assert data["customer_id"] == ""
        assert not data["customer_phone"] and not data["customer_email"]
        assert "Alishiba" not in resp.model_dump_json() and str(o.customer_id) not in resp.model_dump_json()


def test_customer_view_is_unchanged() -> None:
    o = _order()
    data = _order_resp(o, customer_name="Ada Obi").model_dump()
    assert data["delivery_address"]["street"] == "7 Alishiba St"
    assert data["customer_id"] == str(o.customer_id) and data["customer_name"] is None
