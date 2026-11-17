"""Paystack webhook signatures: bare hex (legacy), and signed-header styles (t=…,v1=…)."""
import hashlib
import hmac
import json

import pytest

from core.exceptions import AppError
from services.payment.providers.paystack import PaystackProvider, _mask_header

BODY = json.dumps({"event": "charge.success", "data": {"reference": "avdan-x", "amount": 1000}}).encode()
KEY = "whsec_test_key"


def _hex(message: bytes, key: str = KEY, algo=hashlib.sha512) -> str:  # type: ignore[no-untyped-def]
    return hmac.new(key.encode(), message, algo).hexdigest()


def _provider() -> PaystackProvider:
    return PaystackProvider(secret_key="rk_live_other", webhook_secret=KEY)


@pytest.mark.parametrize("header", [
    _hex(BODY),                                              # legacy: bare HMAC-SHA512 of the body
    f"sha512={_hex(BODY)}",                                  # prefixed
    f"t=1763340000,v1={_hex(b'1763340000.' + BODY)}",        # Stripe-style, signed "<t>.<body>", SHA-512
    f"t=1763340000,v1={_hex(b'1763340000.' + BODY, algo=hashlib.sha256)}",  # SHA-256
    f"t=1763340000,v0=deadbeef,v1={_hex(b'1763340000' + BODY)}",  # extra junk part, "<t><body>"
])
def test_valid_signatures_accepted(header: str) -> None:
    import asyncio

    event = asyncio.run(_provider().verify_webhook(BODY, header, header_name="paystack-signature"))
    assert event.event_type == "charge.success" and event.reference == "avdan-x"


@pytest.mark.parametrize("header", [
    _hex(BODY, key="wrong"),
    f"t=1763340000,v1={_hex(b'1763340000.' + BODY, key='wrong')}",
    f"t=1763340000,v1={_hex(b'1763340001.' + BODY)}",       # timestamp tampered
    "garbage",
])
def test_invalid_signatures_rejected(header: str) -> None:
    import asyncio

    with pytest.raises(AppError):
        asyncio.run(_provider().verify_webhook(BODY, header, header_name="paystack-signature"))


def test_mask_shows_layout_but_not_signature() -> None:
    masked = _mask_header(f"t=1763340000,v1={'ab' * 64}")
    assert masked == "t=<10d>,v1=<128h>"
    assert "ab" not in masked
