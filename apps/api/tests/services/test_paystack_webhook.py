"""Webhook signature verification — pure, no database."""
import asyncio
import hashlib
import hmac
import json

import pytest

from core.exceptions import AppError
from services.payment.providers.paystack import PaystackProvider

BODY = json.dumps({"event": "transfer.success", "data": {"reference": "wd-1", "amount": 100}}).encode()


def _sign(key: str) -> str:
    return hmac.new(key.encode(), BODY, hashlib.sha512).hexdigest()


def _verify(provider: PaystackProvider, signature: str):  # type: ignore[no-untyped-def]
    return asyncio.run(provider.verify_webhook(BODY, signature))


def test_verifies_with_api_key_when_no_webhook_secret() -> None:
    assert _verify(PaystackProvider("sk_live_abc"), _sign("sk_live_abc")).event_type == "transfer.success"


def test_restricted_api_key_needs_the_account_secret_key_for_webhooks() -> None:
    signed_by_account_key = _sign("sk_live_account")
    with pytest.raises(AppError) as exc:  # the situation after switching to a restricted key
        _verify(PaystackProvider("rk_live_restricted"), signed_by_account_key)
    assert exc.value.code == "INVALID_SIGNATURE"
    ok = _verify(PaystackProvider("rk_live_restricted", webhook_secret="sk_live_account"), signed_by_account_key)
    assert ok.reference == "wd-1"


def test_signing_key_verifies_new_header_format_and_diagnostic_survives_log_redaction(caplog) -> None:  # type: ignore[no-untyped-def]
    import logging

    from core.logging import SensitiveDataFilter

    provider = PaystackProvider("rk_live_restricted", webhook_secret="whsec_signingkey")
    assert _verify(provider, _sign("whsec_signingkey")).reference == "wd-1"

    with caplog.at_level(logging.WARNING, logger="services.payment.providers.paystack"):
        with pytest.raises(AppError):
            asyncio.run(provider.verify_webhook(BODY, "t=123,v1=abc", header_name="paystack-signature"))
    record = caplog.records[-1]
    SensitiveDataFilter().filter(record)  # what the app's handler does before writing
    msg = record.getMessage()
    assert "sig_shape=structured" in msg and "header=new" in msg
    assert "whsec" in msg and "signingkey" not in msg  # prefix only, never the key


def test_wrong_signature_is_rejected() -> None:
    with pytest.raises(AppError):
        _verify(PaystackProvider("sk_live_abc", webhook_secret="sk_live_other"), _sign("sk_live_nope"))
