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
    # Accounts on restricted keys get `Paystack-Signature` (t=…,v1=<kid>:<sig>, signed with the
    # webhook signing secret); accounts that still hold a secret key also get the legacy
    # `x-paystack-signature`. Accept an event if either header verifies.
    candidates = [
        (name, value)
        for name, value in (
            ("paystack-signature", paystack_signature),
            ("x-paystack-signature", x_paystack_signature),
        )
        if value
    ]
    if not candidates:
        raise AppError(400, "MISSING_SIGNATURE", "paystack-signature header is required")

    # Read raw bytes — required for HMAC verification
    payload = await request.body()

    # Signature verified FIRST — no processing if invalid
    provider = get_provider("paystack")
    event = None
    last_error: AppError | None = None
    for name, value in candidates:
        try:
            event = await provider.verify_webhook(payload, value, header_name=name)
            break
        except AppError as exc:
            last_error = exc
    if event is None:
        raise last_error or AppError(401, "INVALID_SIGNATURE", "Webhook signature verification failed")

    svc = PaymentService(db)

    if event.event_type == "charge.success":
        await svc.handle_charge_success(event.reference, event.raw_data)
    elif event.event_type in ("transfer.success", "transfer.failed", "transfer.reversed"):
        await svc.handle_transfer_webhook(event.event_type, event.reference)

    # Always return 200 quickly — Paystack retries on non-200
    return {"status": "ok"}
