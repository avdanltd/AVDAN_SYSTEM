import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from core.limiter import limiter
from core.redis import get_redis
from services.dispatch.schemas import (
    AssignRiderRequest,
    AssignRiderResponse,
    AvailabilityUpdate,
    LocationUpdate,
    RiderResponse,
)
from services.dispatch.service import DispatchService
from services.orders.schemas import OrderItemResponse, OrderResponse

router = APIRouter()


def _rider_resp(rider: object) -> RiderResponse:
    from services.dispatch.models import Rider
    r: Rider = rider  # type: ignore[assignment]
    return RiderResponse(
        id=str(r.id),
        user_id=str(r.user_id),
        zone_id=str(r.zone_id) if r.zone_id else None,
        online=r.online,
        vehicle_type=r.vehicle_type,
        lat=float(r.lat) if r.lat is not None else None,
        lng=float(r.lng) if r.lng is not None else None,
    )


# ── Rider endpoints ───────────────────────────────────────────────────────────

@router.get("/me", response_model=RiderResponse)
async def get_my_rider_profile(
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> RiderResponse:
    """The caller's own rider record. Without this the mobile app had no way to learn its
    real online/offline state on launch and always assumed offline, which could contradict
    what dispatch actually saw."""
    svc = DispatchService(db, redis)
    rider = await svc.get_or_create_rider(current_user.user_id)
    return _rider_resp(rider)


@router.post("/me/availability", response_model=RiderResponse)
async def set_availability(
    data: AvailabilityUpdate,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> RiderResponse:
    svc = DispatchService(db, redis)
    rider = await svc.set_availability(current_user.user_id, data.online)
    return _rider_resp(rider)


@router.post("/me/location", response_model=RiderResponse)
@limiter.limit("30/minute")
async def update_location(
    request: Request,
    data: LocationUpdate,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> RiderResponse:
    svc = DispatchService(db, redis)
    rider = await svc.update_location(current_user.user_id, data.lat, data.lng)
    return _rider_resp(rider)


# ── Admin/Dispatch endpoints ──────────────────────────────────────────────────

@router.post("/assign/{order_id}", response_model=AssignRiderResponse)
async def assign_rider(
    order_id: str,
    data: AssignRiderRequest,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> AssignRiderResponse:
    svc = DispatchService(db, redis)
    rider = await svc.assign_rider(order_id, rider_id=data.rider_id)
    return AssignRiderResponse(
        order_id=order_id,
        rider_id=str(rider.id),
        message="Rider assigned successfully",
    )


def _order_item_resp(i: object) -> OrderItemResponse:
    from services.orders.models import OrderItem
    it: OrderItem = i  # type: ignore[assignment]
    return OrderItemResponse(
        id=str(it.id),
        product_id=str(it.product_id),
        product_name=it.product_name,
        product_image_url=it.product_image_url,
        price_kobo=it.price_kobo,
        quantity=it.quantity,
        subtotal_kobo=it.subtotal_kobo,
    )


def _order_resp(o: object) -> OrderResponse:
    from services.orders.models import Order
    order: Order = o  # type: ignore[assignment]
    return OrderResponse(
        id=str(order.id),
        customer_id=str(order.customer_id),
        vendor_id=str(order.vendor_id),
        status=order.status,
        total_kobo=order.total_kobo,
        delivery_address=order.delivery_address,
        items=[_order_item_resp(i) for i in (order.items or [])],
        created_at=order.created_at.isoformat(),
        updated_at=order.updated_at.isoformat(),
    )


@router.get("/me/orders", response_model=list[OrderResponse])
async def get_my_orders(
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> list[OrderResponse]:
    """Active work queue only — orders the rider still has to act on."""
    svc = DispatchService(db, redis)
    orders = await svc.get_rider_orders(current_user.user_id)
    return [_order_resp(o) for o in orders]


# NOTE: this route MUST stay declared above /me/orders/{order_id}, otherwise FastAPI
# matches the literal path segment "history" as an order_id and returns a 422/404.
@router.get("/me/orders/history", response_model=list[OrderResponse])
async def get_my_order_history(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> list[OrderResponse]:
    """Completed/terminal orders this rider handled, newest first."""
    svc = DispatchService(db, redis)
    orders = await svc.get_rider_order_history(current_user.user_id, limit=limit, offset=offset)
    return [_order_resp(o) for o in orders]


@router.get("/me/orders/{order_id}", response_model=OrderResponse)
async def get_my_order(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> OrderResponse:
    """One order in ANY status, scoped to this rider — so the detail screen survives
    the order leaving the active queue after delivery."""
    svc = DispatchService(db, redis)
    order = await svc.get_rider_order(current_user.user_id, order_id)
    return _order_resp(order)


@router.post("/me/orders/{order_id}/pickup", response_model=dict)
async def mark_picked_up(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    from services.orders.state_machine import OrderStatus
    svc = DispatchService(db, redis)
    order = await svc.rider_transition(current_user.user_id, order_id, OrderStatus.PICKED_UP)
    return {"order_id": order_id, "status": order.status}


@router.post("/me/orders/{order_id}/transit", response_model=dict)
async def mark_in_transit(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    from services.orders.state_machine import OrderStatus
    svc = DispatchService(db, redis)
    order = await svc.rider_transition(current_user.user_id, order_id, OrderStatus.IN_TRANSIT_TO_HUB)
    return {"order_id": order_id, "status": order.status}


@router.post("/me/orders/{order_id}/deliver", response_model=dict)
async def mark_delivered(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    from services.orders.state_machine import OrderStatus
    svc = DispatchService(db, redis)
    order = await svc.rider_transition(current_user.user_id, order_id, OrderStatus.DELIVERED)
    return {"order_id": order_id, "status": order.status}


@router.post("/me/orders/{order_id}/fail", response_model=dict)
async def mark_failed_delivery(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    from services.orders.state_machine import OrderStatus
    svc = DispatchService(db, redis)
    order = await svc.rider_transition(current_user.user_id, order_id, OrderStatus.FAILED_DELIVERY)
    return {"order_id": order_id, "status": order.status}


@router.get("/riders/available", response_model=list[RiderResponse])
async def get_available_riders(
    zone_id: str | None = Query(default=None),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> list[RiderResponse]:
    svc = DispatchService(db, redis)
    riders = await svc.get_available_riders(zone_id)
    return [_rider_resp(r) for r in riders]


@router.get("/riders", response_model=list[RiderResponse])
async def list_all_riders(
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> list[RiderResponse]:
    from sqlalchemy import select

    from services.dispatch.models import Rider
    result = await db.execute(select(Rider))
    return [_rider_resp(r) for r in result.scalars().all()]
