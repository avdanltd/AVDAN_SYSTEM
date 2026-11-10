"""Webhook endpoints — signature verified BEFORE any processing, no exceptions."""
from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.exceptions import AppError
from services.payment.providers.registry import get_provider
from services.payment.service import PaymentService

webhook_router = APIRouter()


@webhook_router.post("/paystack")
async def paystack_webhook(
    request: Request,
    paystack_signature: str | None = Header(default=None),
    x_paystack_signature: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Accounts that moved to restricted keys are signed with the webhook signing key and send
    # `Paystack-Signature`; the legacy `x-paystack-signature` is signed with the old secret key.
    # Accept either — the provider verifies it against every signing key we hold.
    header_name = "paystack-signature" if paystack_signature else "x-paystack-signature"
    signature = paystack_signature or x_paystack_signature
    if not signature:
        raise AppError(400, "MISSING_SIGNATURE", "paystack-signature header is required")

    # Read raw bytes — required for HMAC verification
    payload = await request.body()

    # Signature verified FIRST — no processing if invalid
    provider = get_provider("paystack")
    event = await provider.verify_webhook(payload, signature, header_name=header_name)

    svc = PaymentService(db)

    if event.event_type == "charge.success":
        await svc.handle_charge_success(event.reference, event.raw_data)
    elif event.event_type in ("transfer.success", "transfer.failed", "transfer.reversed"):
        await svc.handle_transfer_webhook(event.event_type, event.reference)

    # Always return 200 quickly — Paystack retries on non-200
    return {"status": "ok"}
