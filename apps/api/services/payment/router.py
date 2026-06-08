from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, get_current_user, require_role
from services.payment.schemas import EscrowStatusResponse, InitiatePaymentResponse
from services.payment.service import PaymentService

router = APIRouter()


def _escrow_resp(escrow: object) -> EscrowStatusResponse:
    from services.payment.models import EscrowTransaction
    e: EscrowTransaction = escrow  # type: ignore[assignment]
    return EscrowStatusResponse(
        id=str(e.id),
        order_id=str(e.order_id),
        provider=e.provider,
        provider_ref=e.provider_ref,
        amount_kobo=e.amount_kobo,
        status=e.status,
        created_at=e.created_at.isoformat(),
    )


@router.post("/initiate/{order_id}", response_model=InitiatePaymentResponse)
async def initiate_payment(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> InitiatePaymentResponse:
    svc = PaymentService(db)
    payment_url, reference, escrow_id = await svc.initiate_payment(
        order_id, current_user.user_id
    )
    return InitiatePaymentResponse(
        payment_url=payment_url,
        reference=reference,
        escrow_id=escrow_id,
    )


@router.get("/orders/{order_id}", response_model=EscrowStatusResponse)
async def get_escrow_status(
    order_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EscrowStatusResponse:
    svc = PaymentService(db)
    escrow = await svc.get_escrow_for_order(
        order_id, current_user.user_id, current_user.role
    )
    return _escrow_resp(escrow)
