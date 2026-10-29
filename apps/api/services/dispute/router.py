from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, get_current_user, require_role
from services.dispute.schemas import (
    DisputeResponse,
    PaginatedDisputesResponse,
    RaiseDisputeRequest,
)
from services.dispute.service import DisputeService

router = APIRouter()


def _dispute_resp(dispute: object) -> DisputeResponse:
    from services.dispute.models import Dispute
    d: Dispute = dispute  # type: ignore[assignment]
    return DisputeResponse(
        id=str(d.id),
        order_id=str(d.order_id),
        raised_by=str(d.raised_by),
        reason=d.reason,
        description=d.description,
        evidence_urls=d.evidence_urls or [],
        status=d.status,
        resolution=d.resolution,
        resolution_notes=d.resolution_notes,
        resolved_at=d.resolved_at.isoformat() if d.resolved_at else None,
        created_at=d.created_at.isoformat(),
    )


@router.post("", response_model=DisputeResponse, status_code=201)
async def raise_dispute(
    data: RaiseDisputeRequest,
    current_user: CurrentUser = Depends(require_role("customer", "vendor")),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    svc = DisputeService(db)
    dispute = await svc.raise_dispute(current_user.user_id, current_user.role, data)
    return _dispute_resp(dispute)


@router.get("/me", response_model=PaginatedDisputesResponse)
async def list_my_disputes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedDisputesResponse:
    svc = DisputeService(db)
    disputes, total = await svc.list_own_disputes(current_user.user_id, page, page_size)
    return PaginatedDisputesResponse(
        items=[_dispute_resp(d) for d in disputes],
        total=total,
        page=page,
        page_size=page_size,
    )
