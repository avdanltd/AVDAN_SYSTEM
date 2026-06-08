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
    x_paystack_signature: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not x_paystack_signature:
        raise AppError(400, "MISSING_SIGNATURE", "x-paystack-signature header is required")

    # Read raw bytes — required for HMAC verification
    payload = await request.body()

    # Signature verified FIRST — no processing if invalid
    provider = get_provider("paystack")
    event = await provider.verify_webhook(payload, x_paystack_signature)

    svc = PaymentService(db)

    if event.event_type == "charge.success":
        await svc.handle_charge_success(event.reference, event.raw_data)

    # Always return 200 quickly — Paystack retries on non-200
    return {"status": "ok"}
