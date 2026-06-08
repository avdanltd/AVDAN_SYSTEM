import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.dependencies import CurrentUser, require_role
from services.orders.schemas import OrderResponse, OrderItemResponse, PaginatedOrdersResponse
from services.qa.schemas import (
    EvidenceUploadResponse,
    HubAnalyticsResponse,
    QAFailRequest,
    QAInspectionResponse,
)
from services.qa.service import QAService

router = APIRouter()

_EVIDENCE_DIR = Path("media") / "qa-evidence"


def _order_resp(order: object) -> OrderResponse:
    from services.orders.models import Order
    o: Order = order  # type: ignore[assignment]
    return OrderResponse(
        id=str(o.id),
        customer_id=str(o.customer_id),
        vendor_id=str(o.vendor_id),
        status=o.status,
        total_kobo=o.total_kobo,
        delivery_address=o.delivery_address,
        items=[
            OrderItemResponse(
                id=str(i.id),
                product_id=str(i.product_id),
                product_name=i.product_name,
                price_kobo=i.price_kobo,
                quantity=i.quantity,
                subtotal_kobo=i.subtotal_kobo,
            )
            for i in (o.items or [])
        ],
        created_at=o.created_at.isoformat(),
    )


@router.get("/orders/inbound", response_model=PaginatedOrdersResponse)
async def list_inbound_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_role("agent")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedOrdersResponse:
    svc = QAService(db)
    orders, total = await svc.list_inbound_orders(current_user.user_id, page, page_size)
    return PaginatedOrdersResponse(
        items=[_order_resp(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/orders/{order_id}/receive", response_model=OrderResponse)
async def receive_order(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("agent")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = QAService(db)
    order = await svc.receive_order(current_user.user_id, order_id)
    return _order_resp(order)


@router.post("/orders/{order_id}/qa/pass", response_model=OrderResponse)
async def qa_pass(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("agent")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = QAService(db)
    order = await svc.qa_pass(current_user.user_id, order_id)
    return _order_resp(order)


@router.post("/orders/{order_id}/qa/fail", response_model=OrderResponse)
async def qa_fail(
    order_id: str,
    data: QAFailRequest,
    current_user: CurrentUser = Depends(require_role("agent")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = QAService(db)
    order = await svc.qa_fail(current_user.user_id, order_id, data)
    return _order_resp(order)


@router.post("/orders/{order_id}/qa/evidence", response_model=EvidenceUploadResponse)
async def upload_evidence(
    order_id: str,
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_role("agent")),
    db: AsyncSession = Depends(get_db),
) -> EvidenceUploadResponse:
    _EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "file").suffix or ".jpg"
    filename = f"{order_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = _EVIDENCE_DIR / filename

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    url = f"/media/qa-evidence/{filename}"

    svc = QAService(db)
    await svc.add_evidence_url(current_user.user_id, order_id, url)

    return EvidenceUploadResponse(url=url, filename=filename)


@router.get("/analytics", response_model=HubAnalyticsResponse)
async def hub_analytics(
    period_days: int = Query(default=7, ge=1, le=90),
    current_user: CurrentUser = Depends(require_role("agent", "admin")),
    db: AsyncSession = Depends(get_db),
) -> HubAnalyticsResponse:
    svc = QAService(db)
    data = await svc.get_hub_analytics(current_user.user_id, period_days)
    return HubAnalyticsResponse(**data)
