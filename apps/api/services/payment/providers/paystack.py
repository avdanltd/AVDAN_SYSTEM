"""Paystack payment provider implementation."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time

import httpx

from core.exceptions import AppError
from services.payment.providers.base import (
    AccountVerifyResult,
    BankInfo,
    ChargeResult,
    PaymentProvider,
    PaymentStatus,
    RecipientResult,
    RefundResult,
    TransferResult,
    WebhookEvent,
)

# httpx's default is 5s, which a Paystack transfer or verify can exceed; the resulting
# unhandled timeout surfaced to admins as "An unexpected error occurred".
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
_BASE_URL = "https://api.paystack.co"


def _paystack_detail(response: httpx.Response) -> str:
    """Extract Paystack's own error message/code from a failed response.

    Every call site used to raise a generic AppError on a non-2xx status, discarding whatever
    Paystack actually said — the only way to learn a real cause (e.g. insufficient_balance,
    a bad recipient, OTP required) was to replay the request by hand outside the app. Paystack
    error bodies are `{"status": false, "message": "...", "code": "..."}`.
    """
    try:
        body = response.json()
    except ValueError:
        return response.text[:200]
    message = body.get("message", "")
    code = body.get("code", "")
    return f"{message} ({code})" if code else message or response.text[:200]


def _paystack_code(response: httpx.Response) -> str:
    """Paystack's machine-readable error code from a failed response, or "" if absent."""
    try:
        return str(response.json().get("code", ""))
    except ValueError:
        return ""


logger = logging.getLogger(__name__)


_HEX_LOWER = frozenset("0123456789abcdef")
# Paystack's documented replay window for the Paystack-Signature timestamp.
_TOLERANCE_SECONDS = 300


def _parse_paystack_signature(header: str) -> tuple[int | None, list[tuple[str, str]]]:
    """Parse `Paystack-Signature: t=<unix>,v1=<key id>:<hex>[,v1=<key id>:<hex>]`.

    Returns (timestamp or None, [(key id, signature)]). Ignores any other fields, as Paystack's
    docs require. A repeated or non-numeric `t` makes the header invalid (timestamp None)."""
    stamp: int | None = None
    seen_t = False
    entries: list[tuple[str, str]] = []
    for part in header.split(","):
        key, sep, value = part.partition("=")
        if not sep:
            continue
        key, value = key.strip(), value.strip()
        if key == "t":
            if seen_t or not value.isdigit():
                return None, []
            seen_t = True
            stamp = int(value)
        elif key == "v1":
            kid, colon, sig = value.partition(":")
            if colon:
                entries.append((kid, sig))
    return stamp, entries


def _verify_signed_header(
    payload: bytes, header: str, secrets: list[str], now: float | None = None
) -> tuple[bool, str]:
    """Verify a `Paystack-Signature` header. Returns (ok, reason) — reason is a short, secret-free
    description of why it failed, for the log."""
    stamp, entries = _parse_paystack_signature(header)
    if stamp is None or not entries:
        return False, "unparseable header (need one t= and at least one v1=<kid>:<sig>)"
    skew = abs((time.time() if now is None else now) - stamp)
    if skew > _TOLERANCE_SECONDS:
        return False, f"timestamp {int(skew)}s off server time (limit {_TOLERANCE_SECONDS}s)"
    candidates = [sig for _, sig in entries if len(sig) == 128 and all(c in _HEX_LOWER for c in sig)]
    if not candidates:
        return False, "no v1 signature of 128 lowercase hex characters"
    message = str(stamp).encode() + b"." + payload
    for secret in secrets:
        expected = hmac.new(secret.encode("utf-8"), message, hashlib.sha512).hexdigest()
        if any(hmac.compare_digest(expected, sig) for sig in candidates):
            return True, ""
    kids = ", ".join(sorted({kid for kid, _ in entries}))
    return False, f"no v1 matched the configured signing secret (kids in header: {kids})"


class PaystackProvider(PaymentProvider):
    def __init__(self, secret_key: str, webhook_secret: str = "") -> None:
        self._secret_key = secret_key
        # `Paystack-Signature` is signed with the dashboard webhook signing secret (whsec_…), whole
        # string including the prefix. The legacy `x-paystack-signature` is signed with the account
        # secret key (sk_…); a restricted key (rk_…) is not one, so it simply never matches.
        self._signing_secrets = [webhook_secret] if webhook_secret else []
        self._legacy_keys = [k for k in (webhook_secret, secret_key) if k]

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._secret_key}",
            "Content-Type": "application/json",
        }

    async def initiate_charge(
        self, order_id: str, amount_kobo: int, customer_email: str, callback_url: str = ""
    ) -> ChargeResult:
        payload: dict = {
            "email": customer_email,
            "amount": amount_kobo,
            "reference": f"avdan-{order_id}",
        }
        if callback_url:
            payload["callback_url"] = callback_url
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f"{_BASE_URL}/transaction/initialize",
                headers=self._headers(),
                json=payload,
            )
        if response.status_code != 200:
            raise AppError(502, "PAYMENT_INIT_FAILED", f"Failed to initiate payment: {_paystack_detail(response)}")
        data = response.json()["data"]
        return ChargeResult(
            payment_url=data["authorization_url"],
            reference=data["reference"],
        )

    async def verify_payment(self, reference: str) -> PaymentStatus:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(
                f"{_BASE_URL}/transaction/verify/{reference}",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise AppError(502, "PAYMENT_VERIFY_FAILED", f"Failed to verify payment: {_paystack_detail(response)}")
        data = response.json()["data"]
        # `amount` is what the customer was actually charged, which includes Paystack's fee when
        # the account is set to make the customer bear it. `requested_amount` is the amount we
        # asked for, i.e. the order total, and is what must match our escrow record.
        return PaymentStatus(
            paid=data["status"] == "success",
            amount_kobo=data.get("requested_amount") or data["amount"],
            reference=data["reference"],
            raw_data=data,
        )

    async def transfer_to_vendor(
        self, recipient_code: str, amount_kobo: int, reference: str
    ) -> TransferResult:
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(
                    f"{_BASE_URL}/transfer",
                    headers=self._headers(),
                    json={
                        "source": "balance",
                        "amount": amount_kobo,
                        "recipient": recipient_code,
                        "reference": reference,
                        "reason": "AVDAN vendor payout",
                    },
                )
        except httpx.HTTPError as exc:
            # The request may or may not have reached Paystack. Nothing is committed on our side,
            # and the reference is the same on a retry, so Paystack refuses a duplicate: safe to
            # try again, but check Paystack's transfer list first if unsure.
            raise AppError(
                502,
                "TRANSFER_NO_RESPONSE",
                f"Could not reach Paystack ({type(exc).__name__}). Check the transfer list in "
                "Paystack before trying again.",
            ) from exc
        if response.status_code not in (200, 201):
            # A recipient code that Paystack doesn't recognise (placeholder data, or one created
            # under a different secret key — every test-mode code is invalid once the live key is
            # in use) is the vendor's payout setup, not a transient failure; retrying can't fix it.
            if _paystack_code(response) == "invalid_transfer_recipient":
                raise AppError(
                    422,
                    "VENDOR_PAYOUT_RECIPIENT_INVALID",
                    "Vendor's saved payout account is not valid on this Paystack account — "
                    "the vendor must re-save their payout bank account",
                )
            raise AppError(502, "TRANSFER_FAILED", f"Failed to transfer to vendor: {_paystack_detail(response)}")
        data = response.json()["data"]
        return TransferResult(
            transfer_ref=data.get("transfer_code", reference),
            status=data.get("status", ""),
        )

    async def verify_transfer(self, reference: str) -> TransferResult | None:
        """GET /transfer/verify/{reference} — the pull-based counterpart of the transfer.* webhooks,
        used to settle payouts whose webhook never arrived."""
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.get(
                    f"{_BASE_URL}/transfer/verify/{reference}", headers=self._headers()
                )
        except httpx.HTTPError as exc:
            raise AppError(
                502, "TRANSFER_VERIFY_NO_RESPONSE", f"Could not reach Paystack ({type(exc).__name__})."
            ) from exc
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            raise AppError(502, "TRANSFER_VERIFY_FAILED", f"Failed to verify transfer: {_paystack_detail(response)}")
        data = response.json()["data"]
        return TransferResult(transfer_ref=data.get("transfer_code", reference), status=data.get("status", ""))

    async def refund(self, payment_ref: str, amount_kobo: int) -> RefundResult:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f"{_BASE_URL}/refund",
                headers=self._headers(),
                json={
                    "transaction": payment_ref,
                    "amount": amount_kobo,
                },
            )
        if response.status_code not in (200, 201):
            raise AppError(502, "REFUND_FAILED", f"Failed to process refund: {_paystack_detail(response)}")
        data = response.json()["data"]
        return RefundResult(
            refund_ref=str(data.get("id", payment_ref)),
            success=data.get("status") in ("processed", "pending"),
        )

    async def get_banks(self) -> list[BankInfo]:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(
                f"{_BASE_URL}/bank?currency=NGN&perPage=200",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise AppError(502, "BANKS_FETCH_FAILED", f"Failed to fetch bank list: {_paystack_detail(response)}")
        return [
            BankInfo(name=b["name"], code=b["code"])
            for b in response.json().get("data", [])
            if b.get("active") and b.get("type") != "mobile_money"
        ]

    async def resolve_account(
        self, account_number: str, bank_code: str
    ) -> AccountVerifyResult:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(
                f"{_BASE_URL}/bank/resolve",
                headers=self._headers(),
                params={"account_number": account_number, "bank_code": bank_code},
            )
        if response.status_code != 200:
            raise AppError(
                422, "ACCOUNT_RESOLVE_FAILED", f"Could not verify account: {_paystack_detail(response)}"
            )
        data = response.json()["data"]
        return AccountVerifyResult(
            account_name=data["account_name"],
            account_number=data["account_number"],
        )

    async def create_transfer_recipient(
        self, account_name: str, account_number: str, bank_code: str
    ) -> RecipientResult:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f"{_BASE_URL}/transferrecipient",
                headers=self._headers(),
                json={
                    "type": "nuban",
                    "name": account_name,
                    "account_number": account_number,
                    "bank_code": bank_code,
                    "currency": "NGN",
                },
            )
        if response.status_code not in (200, 201):
            raise AppError(
                502, "RECIPIENT_CREATE_FAILED", f"Failed to create transfer recipient: {_paystack_detail(response)}"
            )
        data = response.json()["data"]
        return RecipientResult(recipient_code=data["recipient_code"])

    async def verify_webhook(
        self, payload: bytes, signature: str, header_name: str = ""
    ) -> WebhookEvent:
        if header_name == "paystack-signature":
            matched, reason = _verify_signed_header(payload, signature, self._signing_secrets)
        else:
            # Legacy header: bare HMAC-SHA512 of the raw body, no timestamp.
            signature = signature.strip().lower()
            matched = len(signature) == 128 and any(
                hmac.compare_digest(
                    hmac.new(key.encode("utf-8"), payload, hashlib.sha512).hexdigest(), signature
                )
                for key in self._legacy_keys
            )
            reason = "no match against the account secret key"
        if not matched:
            # NB: core.logging redacts any line containing words like "secret" or "token", so this
            # message avoids them. It records the failure reason and header kind, never a key.
            logger.warning(
                "paystack webhook signature mismatch: header=%s body=%dB signing_keys_configured=%d reason=%s",
                "new" if header_name == "paystack-signature" else "legacy", len(payload),
                len(self._signing_secrets), reason.replace("secret", "key"),
            )
            raise AppError(401, "INVALID_SIGNATURE", "Webhook signature verification failed")

        body = json.loads(payload)
        event_type: str = body.get("event", "")
        data: dict = body.get("data", {})
        reference: str = data.get("reference", "")
        amount_kobo: int = data.get("amount", 0)
        success = event_type in ("charge.success", "transfer.success")

        return WebhookEvent(
            event_type=event_type,
            reference=reference,
            amount_kobo=amount_kobo,
            success=success,
            raw_data=body,
        )
