from datetime import UTC, datetime, timedelta

from services.orders.service import OrderService


def _quote(fee=100_000, special=0):
    return {"fee_kobo": fee, "special_fee_kobo": special}


def test_promo_off_changes_nothing():
    q = OrderService._apply_delivery_promo(_quote(), {"delivery_promo": {"enabled": False, "percent": 10}})
    assert q["fee_kobo"] == 100_000 and q["discount_kobo"] == 0 and q["regular_fee_kobo"] == 100_000


def test_promo_takes_ten_percent_off():
    q = OrderService._apply_delivery_promo(_quote(), {"delivery_promo": {"enabled": True, "percent": 10}})
    assert q["discount_kobo"] == 10_000 and q["fee_kobo"] == 90_000 and q["regular_fee_kobo"] == 100_000
    assert q["promo_label"]


def test_special_fee_is_not_discounted():
    q = OrderService._apply_delivery_promo(
        _quote(fee=150_000, special=50_000), {"delivery_promo": {"enabled": True, "percent": 10}}
    )
    assert q["discount_kobo"] == 10_000 and q["fee_kobo"] == 140_000


def test_expired_promo_is_ignored():
    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    q = OrderService._apply_delivery_promo(
        _quote(), {"delivery_promo": {"enabled": True, "percent": 10, "ends_at": past}}
    )
    assert q["discount_kobo"] == 0


def test_future_end_date_still_applies():
    future = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    q = OrderService._apply_delivery_promo(
        _quote(), {"delivery_promo": {"enabled": True, "percent": 10, "ends_at": future}}
    )
    assert q["discount_kobo"] == 10_000
