import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from core.redis import get_redis
from services.admin.service import AdminService
from services.analytics.schemas import (
    OrderVolumeResponse,
    OverviewResponse,
    PlatformConfigResponse,
    UpdateConfigRequest,
    VendorAnalyticsResponse,
)
from services.auth.schemas import (
    AdminCreateUserRequest,
    PaginatedUsersResponse,
    UpdateUserStatusRequest,
    UserResponse,
)
from services.auth.service import AuthService
from services.dispute.schemas import (
    DisputeResponse,
    PaginatedDisputesResponse,
    ResolveDisputeRequest,
)
from services.orders.schemas import (
    AdminOverrideStatusRequest,
    OrderDetailResponse,
    OrderEventResponse,
    OrderItemResponse,
    OrderResponse,
    PaginatedOrdersResponse,
)
from services.payment.schemas import EscrowStatusResponse, RefundRequest
from services.qa.schemas import AssignHubRequest, CreateHubRequest, HubResponse
from services.vendor.schemas import (
    AdminVendorResponse,
    PaginatedVendorsResponse,
    UpdateVendorStatusRequest,
)

router = APIRouter()


def _user_response(user: object) -> UserResponse:
    from services.auth.models import User

    u: User = user  # type: ignore[assignment]
    return UserResponse(
        id=str(u.id),
        email=u.email,
        phone=u.phone,
        name=u.name,
        role=u.role,
        status=u.status,
    )


@router.get("/users", response_model=PaginatedUsersResponse)
async def list_users(
    role: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedUsersResponse:
    svc = AdminService(db)
    users, total = await svc.list_users(role=role, status=status, page=page, page_size=page_size)
    return PaginatedUsersResponse(
        items=[_user_response(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: str,
    data: UpdateUserStatusRequest,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    svc = AdminService(db)
    user = await svc.update_user_status(user_id, data.status)
    return _user_response(user)


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_admin_user(
    data: AdminCreateUserRequest,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> UserResponse:
    svc = AuthService(db, redis)
    user = await svc.create_privileged_user(data)
    return _user_response(user)


# ── Vendor management ─────────────────────────────────────────────────────────

def _admin_vendor_response(vendor: object) -> AdminVendorResponse:
    from services.vendor.models import Vendor
    v: Vendor = vendor  # type: ignore[assignment]
    return AdminVendorResponse(
        id=str(v.id),
        user_id=str(v.user_id),
        name=v.name,
        slug=v.slug,
        description=v.description,
        logo_url=v.logo_url,
        status=v.status,
        zone_id=str(v.zone_id) if v.zone_id else None,
        rating=float(v.rating),
    )


@router.get("/vendors", response_model=PaginatedVendorsResponse)
async def list_vendors(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedVendorsResponse:
    svc = AdminService(db)
    vendors, total = await svc.list_vendors(status=status, page=page, page_size=page_size)
    return PaginatedVendorsResponse(
        items=[_admin_vendor_response(v) for v in vendors],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/vendors/{vendor_id}/status", response_model=AdminVendorResponse)
async def update_vendor_status(
    vendor_id: str,
    data: UpdateVendorStatusRequest,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> AdminVendorResponse:
    svc = AdminService(db)
    vendor = await svc.update_vendor_status(vendor_id, data.status)
    return _admin_vendor_response(vendor)


# ── Order management ──────────────────────────────────────────────────────────

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
    )


@router.get("/orders", response_model=PaginatedOrdersResponse)
async def list_all_orders(
    status: str | None = Query(default=None),
    vendor_id: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedOrdersResponse:
    svc = AdminService(db)
    orders, total = await svc.list_orders(
        status=status,
        vendor_id=vendor_id,
        customer_id=customer_id,
        page=page,
        page_size=page_size,
    )
    return PaginatedOrdersResponse(
        items=[_order_resp(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
async def get_order_detail(
    order_id: str,
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> OrderDetailResponse:
    svc = AdminService(db)
    order = await svc.get_order_detail(order_id)
    return _order_detail_resp(order)


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def override_order_status(
    order_id: str,
    data: AdminOverrideStatusRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    svc = AdminService(db)
    order = await svc.override_order_status(
        order_id, data.status, data.reason, current_user.user_id
    )
    return _order_resp(order)


# ── Payment / refund management ───────────────────────────────────────────────

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


@router.post("/payment/refund/{order_id}", response_model=EscrowStatusResponse)
async def refund_order(
    order_id: str,
    data: RefundRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> EscrowStatusResponse:
    from services.payment.service import PaymentService
    svc = PaymentService(db)
    escrow = await svc.process_refund(
        order_id, data.amount_kobo, current_user.user_id, data.reason
    )
    return _escrow_resp(escrow)


# ── Dispute management ────────────────────────────────────────────────────────

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


@router.get("/disputes", response_model=PaginatedDisputesResponse)
async def list_all_disputes(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedDisputesResponse:
    from services.dispute.service import DisputeService
    svc = DisputeService(db)
    disputes, total = await svc.list_all_disputes(status, page, page_size)
    return PaginatedDisputesResponse(
        items=[_dispute_resp(d) for d in disputes],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/disputes/{dispute_id}", response_model=DisputeResponse)
async def get_dispute_detail(
    dispute_id: str,
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    from services.dispute.service import DisputeService
    svc = DisputeService(db)
    dispute = await svc.get_dispute_detail(dispute_id)
    return _dispute_resp(dispute)


@router.post("/disputes/{dispute_id}/resolve", response_model=DisputeResponse)
async def resolve_dispute(
    dispute_id: str,
    data: ResolveDisputeRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    from services.dispute.service import DisputeService
    svc = DisputeService(db)
    dispute = await svc.resolve_dispute(dispute_id, current_user.user_id, data)
    return _dispute_resp(dispute)


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics/overview", response_model=OverviewResponse)
async def analytics_overview(
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> OverviewResponse:
    from services.analytics.service import AnalyticsService
    data = await AnalyticsService(db).get_overview()
    return OverviewResponse(**data)


@router.get("/analytics/orders", response_model=OrderVolumeResponse)
async def analytics_orders(
    period: str = Query(default="day", pattern="^(day|week|month)$"),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> OrderVolumeResponse:
    from services.analytics.service import AnalyticsService
    data = await AnalyticsService(db).get_order_volume(period)
    return OrderVolumeResponse(**data)


@router.get("/analytics/vendors/{vendor_id}", response_model=VendorAnalyticsResponse)
async def analytics_vendor(
    vendor_id: str,
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> VendorAnalyticsResponse:
    from services.analytics.service import AnalyticsService
    data = await AnalyticsService(db).get_vendor_analytics(vendor_id)
    return VendorAnalyticsResponse(**data)


# ── Platform config ───────────────────────────────────────────────────────────

@router.get("/config", response_model=PlatformConfigResponse)
async def get_platform_config(
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PlatformConfigResponse:
    from services.analytics.service import AnalyticsService
    config = await AnalyticsService(db).get_config()
    return PlatformConfigResponse(config=config)


@router.patch("/config", response_model=PlatformConfigResponse)
async def update_platform_config(
    data: UpdateConfigRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> PlatformConfigResponse:
    from services.analytics.service import AnalyticsService
    config = await AnalyticsService(db).update_config(data.updates, current_user.user_id)
    return PlatformConfigResponse(config=config)


# ── Hub management ────────────────────────────────────────────────────────────

def _hub_resp(hub: object) -> HubResponse:
    from services.qa.models import AgentHub
    h: AgentHub = hub  # type: ignore[assignment]
    return HubResponse(
        id=str(h.id),
        name=h.name,
        active=h.active,
        capacity=h.capacity,
        lat=float(h.lat) if h.lat is not None else None,
        lng=float(h.lng) if h.lng is not None else None,
    )


@router.get("/hubs", response_model=list[HubResponse])
async def list_hubs(
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> list[HubResponse]:
    svc = AdminService(db)
    hubs = await svc.list_hubs()
    return [_hub_resp(h) for h in hubs]


@router.post("/hubs", response_model=HubResponse, status_code=201)
async def create_hub(
    data: CreateHubRequest,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> HubResponse:
    svc = AdminService(db)
    hub = await svc.create_hub(data.name, data.capacity, data.lat, data.lng)
    return _hub_resp(hub)


@router.patch("/users/{user_id}/hub", response_model=UserResponse)
async def assign_agent_hub(
    user_id: str,
    data: AssignHubRequest,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    svc = AdminService(db)
    user = await svc.assign_agent_hub(user_id, data.hub_id)
    return _user_response(user)
