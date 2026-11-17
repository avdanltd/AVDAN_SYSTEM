"""Starting payment twice on one order must not reuse a Paystack reference (that is a 400)."""
import uuid

from services.auth.models import User
from services.orders.models import Order
from services.orders.state_machine import OrderStatus
from services.payment.models import EscrowTransaction
from services.payment.providers.base import ChargeResult
from services.payment.service import PaymentService
from services.vendor.models import Vendor
from tests.services.test_admin_attention import run


class _FakePaystack:
    """Mimics Paystack: a reference can only be initialised once."""

    def __init__(self) -> None:
        self.seen: set[str] = set()

    async def initiate_charge(self, order_id, amount_kobo, email, callback_url="", reference_suffix=None):  # type: ignore[no-untyped-def]
        ref = f"avdan-{order_id}" + (f"-{reference_suffix}" if reference_suffix else "")
        assert ref not in self.seen, "Duplicate Transaction Reference"
        self.seen.add(ref)
        return ChargeResult(payment_url=f"https://pay.test/{ref}", reference=ref)


def test_second_payment_attempt_uses_a_fresh_reference(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    fake = _FakePaystack()
    monkeypatch.setattr("services.payment.service.get_provider", lambda name: fake)

    async def body(db):  # type: ignore[no-untyped-def]
        uid = uuid.uuid4().hex[:8]
        cust = User(role="customer", email=f"c{uid}@t.io", password_hash="x", name="C", status="active")
        vu = User(role="vendor", email=f"v{uid}@t.io", password_hash="x", name="V", status="active")
        db.add_all([cust, vu])
        await db.flush()
        vendor = Vendor(user_id=vu.id, name=f"S{uid}", slug=f"s-{uid}", status="approved")
        db.add(vendor)
        await db.flush()
        order = Order(customer_id=cust.id, vendor_id=vendor.id, status=OrderStatus.PENDING,
                      total_kobo=1000, delivery_fee_kobo=500, delivery_address={"street": "s"})
        db.add(order)
        await db.flush()
        oid, cid = str(order.id), str(cust.id)

        svc = PaymentService(db)
        _, ref1, _ = await svc.initiate_payment(oid, cid)
        _, ref2, _ = await svc.initiate_payment(oid, cid)
        _, ref3, _ = await svc.initiate_payment(oid, cid)
        assert ref1 == f"avdan-{oid}"
        assert len({ref1, ref2, ref3}) == 3
        rows = (await db.execute(
            EscrowTransaction.__table__.select().where(EscrowTransaction.order_id == order.id)
        )).all()
        assert len(rows) == 3
    run(body)
