from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from services.orders.schemas import (
    CreateOrderRequest,
    DeliveryQuoteResponse,
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
        product_image_url=i.product_image_url,
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


def _order_resp(order: object, vendor_name: str | None = None) -> OrderResponse:
    from services.orders.models import Order
    o: Order = order  # type: ignore[assignment]
    return OrderResponse(
        id=str(o.id),
        customer_id=str(o.customer_id),
        vendor_id=str(o.vendor_id),
        vendor_name=vendor_name,
        status=o.status,
        total_kobo=o.total_kobo,
        delivery_fee_kobo=o.delivery_fee_kobo,
        delivery_quote=o.delivery_quote,
        delivery_address=o.delivery_address,
        items=[_item_resp(i) for i in (o.items or [])],
        created_at=o.created_at.isoformat(),
        updated_at=o.updated_at.isoformat(),
    )


def _order_detail_resp(order: object, vendor_name: str | None = None) -> OrderDetailResponse:
    from services.orders.models import Order
    o: Order = order  # type: ignore[assignment]
    return OrderDetailResponse(
        id=str(o.id),
        customer_id=str(o.customer_id),
        vendor_id=str(o.vendor_id),
        vendor_name=vendor_name,
        status=o.status,
        total_kobo=o.total_kobo,
        delivery_fee_kobo=o.delivery_fee_kobo,
        delivery_quote=o.delivery_quote,
        delivery_address=o.delivery_address,
        items=[_item_resp(i) for i in (o.items or [])],
        events=[_event_resp(e) for e in (o.events or [])],
        created_at=o.created_at.isoformat(),
        updated_at=o.updated_at.isoformat(),
    )


def _with_code(resp, order: object):  # type: ignore[no-untyped-def]
    """Attach the handover code for the customer's own view, only once the parcel is on the
    road — it is the customer's secret, so no other role's response ever carries it."""
    from services.orders.models import Order
    o: Order = order  # type: ignore[assignment]
    if o.status == "OUT_FOR_DELIVERY":
        resp.delivery_code = o.delivery_code
    return resp


async def _vendor_names(db: AsyncSession, order_list: list) -> dict:
    """Batch-fetch {vendor_id: vendor_name} for a list of orders — Order has no
    `vendor` relationship (see services/orders/models.py), so this mirrors the
    pattern already used in services/qa/router.py rather than lazy-loading one."""
    from sqlalchemy import select

    from services.vendor.models import Vendor

    vendor_ids = list({o.vendor_id for o in order_list})
    if not vendor_ids:
        return {}
    res = await db.execute(select(Vendor).where(Vendor.id.in_(vendor_ids)))
    return {v.id: v.name for v in res.scalars().all()}


# ── Customer endpoints ────────────────────────────────────────────────────────

@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(
    data: CreateOrderRequest,
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = OrderService(db)
    order = await svc.create_order(current_user.user_id, data)
    vendor_names = await _vendor_names(db, [order])
    return _order_resp(order, vendor_name=vendor_names.get(order.vendor_id))


@router.get("/delivery-quote", response_model=DeliveryQuoteResponse)
async def delivery_quote(
    vendor_id: str,
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    _current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> DeliveryQuoteResponse:
    """What delivering from this vendor to these coordinates would cost — shown at checkout
    before the order exists, using the same calculation that prices the real order."""
    svc = OrderService(db)
    from services.analytics.service import AnalyticsService

    quote = await svc.quote_delivery_for_vendor(vendor_id, {"lat": lat, "lng": lng})
    min_order = int((await AnalyticsService(db).get_config()).get("min_order_kobo", 0) or 0)
    return DeliveryQuoteResponse(**quote, min_order_kobo=min_order)


@router.get("", response_model=PaginatedOrdersResponse)
async def list_my_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedOrdersResponse:
    svc = OrderService(db)
    orders, total = await svc.list_customer_orders(current_user.user_id, page, page_size)
    vendor_names = await _vendor_names(db, orders)
    return PaginatedOrdersResponse(
        items=[_order_resp(o, vendor_name=vendor_names.get(o.vendor_id)) for o in orders],
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
    vendor_names = await _vendor_names(db, [order])
    return _with_code(_order_detail_resp(order, vendor_name=vendor_names.get(order.vendor_id)), order)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = OrderService(db)
    order = await svc.cancel_order(current_user.user_id, order_id)
    vendor_names = await _vendor_names(db, [order])
    return _order_resp(order, vendor_name=vendor_names.get(order.vendor_id))


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
