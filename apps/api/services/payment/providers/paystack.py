"""Paystack payment provider implementation."""
from __future__ import annotations

import hashlib
import hmac
import json

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

_BASE_URL = "https://api.paystack.co"


class PaystackProvider(PaymentProvider):
    def __init__(self, secret_key: str) -> None:
        self._secret_key = secret_key

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
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{_BASE_URL}/transaction/initialize",
                headers=self._headers(),
                json=payload,
            )
        if response.status_code != 200:
            raise AppError(502, "PAYMENT_INIT_FAILED", "Failed to initiate payment")
        data = response.json()["data"]
        return ChargeResult(
            payment_url=data["authorization_url"],
            reference=data["reference"],
        )

    async def verify_payment(self, reference: str) -> PaymentStatus:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{_BASE_URL}/transaction/verify/{reference}",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise AppError(502, "PAYMENT_VERIFY_FAILED", "Failed to verify payment")
        data = response.json()["data"]
        return PaymentStatus(
            paid=data["status"] == "success",
            amount_kobo=data["amount"],
            reference=data["reference"],
            raw_data=data,
        )

    async def transfer_to_vendor(
        self, recipient_code: str, amount_kobo: int, reference: str
    ) -> TransferResult:
        async with httpx.AsyncClient() as client:
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
        if response.status_code not in (200, 201):
            raise AppError(502, "TRANSFER_FAILED", "Failed to transfer to vendor")
        data = response.json()["data"]
        return TransferResult(
            transfer_ref=data.get("transfer_code", reference),
            success=data.get("status") in ("success", "pending"),
        )

    async def refund(self, payment_ref: str, amount_kobo: int) -> RefundResult:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{_BASE_URL}/refund",
                headers=self._headers(),
                json={
                    "transaction": payment_ref,
                    "amount": amount_kobo,
                },
            )
        if response.status_code not in (200, 201):
            raise AppError(502, "REFUND_FAILED", "Failed to process refund")
        data = response.json()["data"]
        return RefundResult(
            refund_ref=str(data.get("id", payment_ref)),
            success=data.get("status") in ("processed", "pending"),
        )

    async def get_banks(self) -> list[BankInfo]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{_BASE_URL}/bank?currency=NGN&perPage=200",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise AppError(502, "BANKS_FETCH_FAILED", "Failed to fetch bank list")
        return [
            BankInfo(name=b["name"], code=b["code"])
            for b in response.json().get("data", [])
            if b.get("active") and b.get("type") != "mobile_money"
        ]

    async def resolve_account(
        self, account_number: str, bank_code: str
    ) -> AccountVerifyResult:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{_BASE_URL}/bank/resolve",
                headers=self._headers(),
                params={"account_number": account_number, "bank_code": bank_code},
            )
        if response.status_code != 200:
            raise AppError(422, "ACCOUNT_RESOLVE_FAILED", "Could not verify account — check account number and bank")
        data = response.json()["data"]
        return AccountVerifyResult(
            account_name=data["account_name"],
            account_number=data["account_number"],
        )

    async def create_transfer_recipient(
        self, account_name: str, account_number: str, bank_code: str
    ) -> RecipientResult:
        async with httpx.AsyncClient() as client:
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
            raise AppError(502, "RECIPIENT_CREATE_FAILED", "Failed to create transfer recipient")
        data = response.json()["data"]
        return RecipientResult(recipient_code=data["recipient_code"])

    async def verify_webhook(
        self, payload: bytes, signature: str
    ) -> WebhookEvent:
        computed = hmac.new(
            self._secret_key.encode("utf-8"), payload, hashlib.sha512
        ).hexdigest()
        if not hmac.compare_digest(computed, signature):
            raise AppError(400, "INVALID_SIGNATURE", "Webhook signature verification failed")

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
