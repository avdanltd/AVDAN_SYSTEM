"""`Paystack-Signature: t=<unix>,v1=<kid>:<hex>` — verified exactly as Paystack documents it:
HMAC-SHA512 over `<t>.<raw body>`, keyed with the whole whsec_ signing secret, any v1 may match,
and t must be within 300 seconds of server time."""
import asyncio
import hashlib
import hmac
import json
import time

import pytest

from core.exceptions import AppError
from services.payment.providers.paystack import PaystackProvider, _parse_paystack_signature

BODY = json.dumps({"event": "charge.success", "data": {"reference": "avdan-x", "amount": 1000}}).encode()
SECRET = "whsec_live_signing_secret"


def _sig(t: int, body: bytes = BODY, secret: str = SECRET) -> str:
    return hmac.new(secret.encode(), str(t).encode() + b"." + body, hashlib.sha512).hexdigest()


def _header(t: int, *sigs: tuple[str, str]) -> str:
    return f"t={t}," + ",".join(f"v1={kid}:{sig}" for kid, sig in sigs)


def _provider() -> PaystackProvider:
    return PaystackProvider(secret_key="rk_live_restricted", webhook_secret=SECRET)


def _verify(header: str):  # type: ignore[no-untyped-def]
    return asyncio.run(_provider().verify_webhook(BODY, header, header_name="paystack-signature"))


def test_valid_header_accepted() -> None:
    t = int(time.time())
    event = _verify(_header(t, ("whk_3f9a1c2e", _sig(t))))
    assert event.event_type == "charge.success" and event.reference == "avdan-x"


def test_any_of_several_v1_signatures_may_match() -> None:
    """During secret rotation events carry one v1 per secret; only one of them is ours."""
    t = int(time.time())
    other = _sig(t, secret="whsec_the_old_one")
    assert _verify(_header(t, ("whk_old", other), ("whk_new", _sig(t)))).reference == "avdan-x"
    assert _verify(_header(t, ("whk_new", _sig(t)), ("whk_old", other))).reference == "avdan-x"


def test_extra_fields_are_ignored() -> None:
    t = int(time.time())
    header = _header(t, ("whk_a", _sig(t))) + ",v2=something,alg=hs512"
    assert _verify(header).reference == "avdan-x"


@pytest.mark.parametrize("make", [
    lambda t: _header(t, ("whk_a", _sig(t, secret="whsec_wrong"))),            # wrong secret
    lambda t: _header(t, ("whk_a", _sig(t, body=b"{}"))),                      # body tampered
    lambda t: _header(t, ("whk_a", _sig(t + 1))),                              # timestamp tampered
    lambda t: _header(t, ("whk_a", _sig(t).upper())),                          # must be lowercase hex
    lambda t: _header(t, ("whk_a", _sig(t)[:-2])),                             # wrong length
    lambda t: f"t={t},v1={_sig(t)}",                                           # missing key id
    lambda t: f"v1=whk_a:{_sig(t)}",                                           # missing t
    lambda t: f"t={t},t={t},v1=whk_a:{_sig(t)}",                               # repeated t
    lambda t: "garbage",
])
def test_invalid_headers_rejected(make) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(AppError) as exc:
        _verify(make(int(time.time())))
    assert exc.value.status_code == 401


def test_stale_and_future_timestamps_rejected() -> None:
    now = int(time.time())
    for t in (now - 301, now + 301):
        with pytest.raises(AppError):
            _verify(_header(t, ("whk_a", _sig(t))))
    t = now - 299  # inside the window
    assert _verify(_header(t, ("whk_a", _sig(t)))).reference == "avdan-x"


def test_restricted_key_is_not_a_signing_secret() -> None:
    """The new header must be checked against the whsec_ secret only."""
    t = int(time.time())
    header = _header(t, ("whk_a", _sig(t, secret="rk_live_restricted")))
    with pytest.raises(AppError):
        _verify(header)


def test_parse_header() -> None:
    assert _parse_paystack_signature("t=1760270400,v1=whk_3f9a1c2e:9d1b,v1=whk_x:ff") == (
        1760270400, [("whk_3f9a1c2e", "9d1b"), ("whk_x", "ff")],
    )
