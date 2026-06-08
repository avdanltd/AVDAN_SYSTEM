"""Abstract payment provider — all providers must implement this interface."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ChargeResult:
    payment_url: str
    reference: str


@dataclass
class PaymentStatus:
    paid: bool
    amount_kobo: int
    reference: str
    raw_data: dict


@dataclass
class TransferResult:
    transfer_ref: str
    success: bool


@dataclass
class RefundResult:
    refund_ref: str
    success: bool


@dataclass
class WebhookEvent:
    event_type: str       # "charge.success", "transfer.success", etc.
    reference: str        # transaction reference
    amount_kobo: int
    success: bool
    raw_data: dict


class PaymentProvider(ABC):
    @abstractmethod
    async def initiate_charge(
        self, order_id: str, amount_kobo: int, customer_email: str
    ) -> ChargeResult: ...

    @abstractmethod
    async def verify_payment(self, reference: str) -> PaymentStatus: ...

    @abstractmethod
    async def transfer_to_vendor(
        self, recipient_code: str, amount_kobo: int, reference: str
    ) -> TransferResult: ...

    @abstractmethod
    async def refund(self, payment_ref: str, amount_kobo: int) -> RefundResult: ...

    @abstractmethod
    async def verify_webhook(
        self, payload: bytes, signature: str
    ) -> WebhookEvent: ...
