from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, get_current_user, require_role
from services.orders.schemas import (
    CreateOrderRequest,
    OrderDetailResponse,
    OrderEventResponse,
    OrderItemResponse,
    OrderResponse,
    PaginatedOrdersResponse,
    RejectOrderRequest,
)
from services.orders.service import OrderService

router = APIRouter()


# ── Serialisers ───────────────────────────────────────────────────────────────

def _item_resp(item: object) -> OrderItemResponse:
    from services.orders.models import OrderItem
    i: OrderItem = item  # type: ignore[assignment]
    return OrderItemResponse(
        id=str(i.id),
        product_id=str(i.product_id),
        product_name=i.product_name,
        price_kobo=i.price_kobo,
        quantity=i.quantity,
        subtotal_kobo=i.subtotal_kobo,
    )


def _event_resp(event: object) -> OrderEventResponse:
    from services.orders.models import OrderEvent
    e: OrderEvent = event  # type: ignore[assignment]
    return OrderEventResponse(
        id=str(e.id),
        from_state=e.from_state,
        to_state=e.to_state,
        actor_role=e.actor_role,
        metadata=e.event_metadata,
        created_at=e.created_at.isoformat(),
    )


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
        items=[_item_resp(i) for i in (o.items or [])],
        created_at=o.created_at.isoformat(),
        updated_at=o.updated_at.isoformat(),
    )


def _order_detail_resp(order: object) -> OrderDetailResponse:
    from services.orders.models import Order
    o: Order = order  # type: ignore[assignment]
    return OrderDetailResponse(
        id=str(o.id),
        customer_id=str(o.customer_id),
        vendor_id=str(o.vendor_id),
        status=o.status,
        total_kobo=o.total_kobo,
        delivery_address=o.delivery_address,
        items=[_item_resp(i) for i in (o.items or [])],
        events=[_event_resp(e) for e in (o.events or [])],
        created_at=o.created_at.isoformat(),
        updated_at=o.updated_at.isoformat(),
    )


# ── Customer endpoints ────────────────────────────────────────────────────────

@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(
    data: CreateOrderRequest,
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = OrderService(db)
    order = await svc.create_order(current_user.user_id, data)
    return _order_resp(order)


@router.get("", response_model=PaginatedOrdersResponse)
async def list_my_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedOrdersResponse:
    svc = OrderService(db)
    orders, total = await svc.list_customer_orders(current_user.user_id, page, page_size)
    return PaginatedOrdersResponse(
        items=[_order_resp(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{order_id}", response_model=OrderDetailResponse)
async def get_my_order(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> OrderDetailResponse:
    svc = OrderService(db)
    order = await svc.get_customer_order(current_user.user_id, order_id)
    return _order_detail_resp(order)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = OrderService(db)
    order = await svc.cancel_order(current_user.user_id, order_id)
    return _order_resp(order)


# ── Vendor endpoints ──────────────────────────────────────────────────────────

@router.get("/vendor/incoming", response_model=PaginatedOrdersResponse)
async def list_vendor_orders(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedOrdersResponse:
    svc = OrderService(db)
    orders, total = await svc.list_vendor_orders(
        current_user.user_id, status, page, page_size
    )
    return PaginatedOrdersResponse(
        items=[_order_resp(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/vendor/{order_id}", response_model=OrderDetailResponse)
async def get_vendor_order(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> OrderDetailResponse:
    svc = OrderService(db)
    order = await svc.get_vendor_order(current_user.user_id, order_id)
    return _order_detail_resp(order)


@router.post("/vendor/{order_id}/accept", response_model=OrderResponse)
async def accept_order(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = OrderService(db)
    order = await svc.accept_order(current_user.user_id, order_id)
    return _order_resp(order)


@router.post("/vendor/{order_id}/reject", response_model=OrderResponse)
async def reject_order(
    order_id: str,
    data: RejectOrderRequest,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = OrderService(db)
    order = await svc.reject_order(current_user.user_id, order_id, data)
    return _order_resp(order)


@router.post("/vendor/{order_id}/ready", response_model=OrderResponse)
async def mark_order_ready(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = OrderService(db)
    order = await svc.mark_ready(current_user.user_id, order_id)
    return _order_resp(order)
