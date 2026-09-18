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
    PaginatedRiderPayoutsResponse,
    RiderEarningsSummaryResponse,
    RiderPayoutResponse,
    RiderResponse,
)
from services.dispatch.service import DispatchService
from services.orders.schemas import OrderItemResponse, OrderResponse
# Payout schemas are provider-shaped, not vendor-specific (bank name/code, account
# number/name) — reused as-is rather than duplicated for riders.
from services.vendor.schemas import (
    BankResponse,
    PayoutAccountResponse,
    SavePayoutAccountRequest,
    VerifyAccountRequest,
    VerifyAccountResponse,
)

router = APIRouter()


def _rider_resp(
    rider: object, name: str | None = None, phone: str | None = None
) -> RiderResponse:
    from services.dispatch.models import Rider
    r: Rider = rider  # type: ignore[assignment]
    return RiderResponse(
        id=str(r.id),
        user_id=str(r.user_id),
        name=name,
        phone=phone,
        zone_id=str(r.zone_id) if r.zone_id else None,
        online=r.online,
        vehicle_type=r.vehicle_type,
        lat=float(r.lat) if r.lat is not None else None,
        lng=float(r.lng) if r.lng is not None else None,
    )


async def _rider_names(db: AsyncSession, riders: list) -> dict:
    """Batch-fetch {user_id: (name, phone)} for a list of riders — Rider has no `user`
    relationship loaded by default, so this mirrors the pattern used for vendor names
    in services/orders/router.py rather than lazy-loading one per rider."""
    from sqlalchemy import select

    from services.auth.models import User

    user_ids = list({r.user_id for r in riders})
    if not user_ids:
        return {}
    res = await db.execute(select(User).where(User.id.in_(user_ids)))
    return {u.id: (u.name, u.phone) for u in res.scalars().all()}


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


async def _hub_map(db: AsyncSession, orders: list) -> dict:
    """Batch-fetch {hub_id: AgentHub} for a list of orders — lets the rider see where they're
    headed (name + coordinates) as soon as dispatch pre-assigns a hub, not just an opaque id."""
    from sqlalchemy import select

    from services.qa.models import AgentHub

    hub_ids = list({o.hub_id for o in orders if o.hub_id})
    if not hub_ids:
        return {}
    res = await db.execute(select(AgentHub).where(AgentHub.id.in_(hub_ids)))
    return {h.id: h for h in res.scalars().all()}


# Statuses in which the rider is still moving the order TO the hub (or it's sitting there
# awaiting/undergoing QA) — the rider only ever needs the hub's address during this stretch, not
# the customer's. The customer's delivery address is revealed only once the rider has actually
# received the package back from the hub (the `confirm-pickup` action, QA_PASSED -> OUT_FOR_DELIVERY),
# not a moment earlier.
_PRE_HUB_HANDOFF_STATUSES = {
    "PENDING", "PAID", "VENDOR_ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP",
    "IN_TRANSIT_TO_HUB", "ARRIVED_AT_HUB", "AT_HUB", "QA_IN_PROGRESS", "QA_PASSED",
    "QA_FAILED", "VENDOR_REMEDIATION",
}


def _order_resp(o: object, hub: object | None = None) -> OrderResponse:
    from services.orders.models import Order
    from services.qa.models import AgentHub
    order: Order = o  # type: ignore[assignment]
    h: AgentHub | None = hub  # type: ignore[assignment]
    reveal_delivery_address = order.status not in _PRE_HUB_HANDOFF_STATUSES
    return OrderResponse(
        id=str(order.id),
        customer_id=str(order.customer_id),
        vendor_id=str(order.vendor_id),
        rider_id=str(order.rider_id) if order.rider_id else None,
        hub_id=str(order.hub_id) if order.hub_id else None,
        hub_name=h.name if h else None,
        hub_lat=float(h.lat) if h and h.lat is not None else None,
        hub_lng=float(h.lng) if h and h.lng is not None else None,
        status=order.status,
        total_kobo=order.total_kobo,
        delivery_fee_kobo=order.delivery_fee_kobo,
        # Not just hidden client-side — genuinely not sent over the wire before handoff, so
        # there's nothing for the rider's device to leak or a curious rider to inspect early.
        delivery_address=order.delivery_address if reveal_delivery_address else {},
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
    hubs = await _hub_map(db, orders)
    return [_order_resp(o, hubs.get(o.hub_id)) for o in orders]


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
    hubs = await _hub_map(db, orders)
    return [_order_resp(o, hubs.get(o.hub_id)) for o in orders]


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
    hub = (await _hub_map(db, [order])).get(order.hub_id)
    return _order_resp(order, hub)


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


@router.post("/me/orders/{order_id}/arrived-at-hub", response_model=dict)
async def mark_arrived_at_hub(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    from services.orders.state_machine import OrderStatus
    svc = DispatchService(db, redis)
    order = await svc.rider_transition(current_user.user_id, order_id, OrderStatus.ARRIVED_AT_HUB)
    return {"order_id": order_id, "status": order.status}


@router.post("/me/orders/{order_id}/confirm-pickup", response_model=dict)
async def confirm_pickup_from_hub(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> dict:
    """Rider confirms they've collected the parcel back from the hub after QA passed —
    QA_PASSED → OUT_FOR_DELIVERY, already permitted for actor "rider" in the state machine."""
    from services.orders.state_machine import OrderStatus
    svc = DispatchService(db, redis)
    order = await svc.rider_transition(current_user.user_id, order_id, OrderStatus.OUT_FOR_DELIVERY)
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


@router.get("/me/banks", response_model=list[BankResponse])
async def list_rider_banks(
    _current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> list[BankResponse]:
    svc = DispatchService(db, redis)
    banks = await svc.list_banks()
    return [BankResponse(name=b.name, code=b.code) for b in banks]


@router.post("/me/payout-account/verify", response_model=VerifyAccountResponse)
async def verify_rider_payout_account(
    data: VerifyAccountRequest,
    _current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> VerifyAccountResponse:
    svc = DispatchService(db, redis)
    result = await svc.verify_payout_account(data.account_number, data.bank_code)
    from services.payment.providers.base import AccountVerifyResult
    r: AccountVerifyResult = result  # type: ignore[assignment]
    return VerifyAccountResponse(account_name=r.account_name, account_number=r.account_number)


@router.post("/me/payout-account", response_model=PayoutAccountResponse)
async def save_rider_payout_account(
    data: SavePayoutAccountRequest,
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> PayoutAccountResponse:
    svc = DispatchService(db, redis)
    rider = await svc.save_payout_account(
        current_user.user_id,
        data.account_number,
        data.bank_code,
        data.bank_name,
        data.account_name,
    )
    return PayoutAccountResponse(
        has_payout_account=True,
        account_number=rider.payout_account_number,
        bank_name=rider.payout_bank_name,
        account_name=rider.payout_account_name,
    )


@router.get("/me/payout-account", response_model=PayoutAccountResponse)
async def get_rider_payout_account(
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> PayoutAccountResponse:
    svc = DispatchService(db, redis)
    rider = await svc.get_payout_account(current_user.user_id)
    return PayoutAccountResponse(
        has_payout_account=bool(rider.paystack_recipient_code),
        account_number=rider.payout_account_number,
        bank_name=rider.payout_bank_name,
        account_name=rider.payout_account_name,
    )


@router.get("/me/earnings", response_model=RiderEarningsSummaryResponse)
async def get_my_earnings(
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> RiderEarningsSummaryResponse:
    svc = DispatchService(db, redis)
    summary = await svc.get_earnings_summary(current_user.user_id)
    return RiderEarningsSummaryResponse(**summary)


@router.get("/me/payouts", response_model=PaginatedRiderPayoutsResponse)
async def list_my_payouts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_role("rider")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> PaginatedRiderPayoutsResponse:
    svc = DispatchService(db, redis)
    payouts, total = await svc.list_payouts(current_user.user_id, page=page, page_size=page_size)
    return PaginatedRiderPayoutsResponse(
        items=[
            RiderPayoutResponse(
                id=str(p.id),
                order_id=str(p.order_id),
                amount_kobo=p.amount_kobo,
                status=p.status,
                created_at=p.created_at.isoformat(),
            )
            for p in payouts
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/riders/available", response_model=list[RiderResponse])
async def get_available_riders(
    zone_id: str | None = Query(default=None),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> list[RiderResponse]:
    svc = DispatchService(db, redis)
    riders = await svc.get_available_riders(zone_id)
    names = await _rider_names(db, riders)
    return [_rider_resp(r, *names.get(r.user_id, (None, None))) for r in riders]


@router.get("/riders", response_model=list[RiderResponse])
async def list_all_riders(
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> list[RiderResponse]:
    from sqlalchemy import select

    from services.dispatch.models import Rider
    result = await db.execute(select(Rider))
    riders = list(result.scalars().all())
    names = await _rider_names(db, riders)
    return [_rider_resp(r, *names.get(r.user_id, (None, None))) for r in riders]
