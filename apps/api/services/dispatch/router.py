from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from core.redis import get_redis
from services.dispatch.schemas import (
    AssignRiderRequest,
    AssignRiderResponse,
    AvailabilityUpdate,
    LocationUpdate,
    RiderResponse,
)
from services.dispatch.service import DispatchService
from services.orders.schemas import OrderResponse, OrderItemResponse

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
async def update_location(
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


@router.get("/me/orders", response_model=list[OrderResponse])
async def get_my_orders(
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> list[OrderResponse]:
    from services.orders.models import Order, OrderItem
    svc = DispatchService(db, redis)
    orders = await svc.get_rider_orders(current_user.user_id)

    def _item(i: OrderItem) -> OrderItemResponse:
        return OrderItemResponse(
            id=str(i.id),
            product_id=str(i.product_id),
            product_name=i.product_name,
            price_kobo=i.price_kobo,
            quantity=i.quantity,
            subtotal_kobo=i.subtotal_kobo,
        )

    def _order(o: Order) -> OrderResponse:
        return OrderResponse(
            id=str(o.id),
            customer_id=str(o.customer_id),
            vendor_id=str(o.vendor_id),
            status=o.status,
            total_kobo=o.total_kobo,
            delivery_address=o.delivery_address,
            items=[_item(i) for i in (o.items or [])],
            created_at=o.created_at.isoformat(),
            updated_at=o.updated_at.isoformat(),
        )

    return [_order(o) for o in orders]


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
