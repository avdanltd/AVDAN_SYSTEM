from datetime import date, datetime

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.address import address_fields
from core.database import get_db
from core.dependencies import CurrentUser, require_role
from core.redis import get_redis
from services.admin.finance import FinanceService
from services.admin.schemas import (
    AdminProductResponse,
    AdminVendorProfileResponse,
    ApproveBranchRequest,
    ApproveProductRequest,
    AttentionResponse,
    BranchRequestResponse,
    BusinessSummary,
    NewUserStatsResponse,
    OrderStatsResponse,
    PaginatedAdminProductsResponse,
    PaginatedProductVendorsResponse,
    RejectBranchRequest,
    RejectProductRequest,
    RenameBusinessRequest,
    SetProductCategoryRequest,
    SetVendorBusinessRequest,
    UserCountsResponse,
)
from services.admin.service import AdminService
from services.analytics.audit import record_audit
from services.analytics.schemas import (
    OrderVolumeResponse,
    OverviewResponse,
    PaginatedAuditLogResponse,
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
from services.qa.schemas import AssignHubRequest, CreateHubRequest, HubResponse, UpdateHubRequest
from services.vendor.schemas import (
    AdminVendorResponse,
    PaginatedVendorsResponse,
    PostVendorMessageRequest,
    UpdateVendorStatusRequest,
    VendorMessageResponse,
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
        created_at=u.created_at.isoformat() if u.created_at else "",
    )


@router.get("/attention", response_model=AttentionResponse)
async def attention(
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> AttentionResponse:
    return AttentionResponse(**await AdminService(db).attention_counts())


# ── Financial tracker ─────────────────────────────────────────────────────────
# Read-only. The period is a start/end instant; the web app turns "24 hours / 1 week / 1 month" and
# From/To dates (Lagos time) into these.

@router.get("/finance/summary")
async def finance_summary(
    start: datetime,
    end: datetime,
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await FinanceService(db).summary(start, end)


@router.get("/finance/pending")
async def finance_pending(
    start: datetime,
    end: datetime,
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Orders paid for but not yet released: money that is coming in."""
    return await FinanceService(db).pending_orders(start, end)


@router.get("/finance/people")
async def finance_people(
    kind: str = Query(pattern="^(vendor|rider|customer)$"),
    start: datetime = Query(),
    end: datetime = Query(),
    search: str | None = Query(default=None, max_length=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await FinanceService(db).people(kind, start, end, search)


@router.get("/finance/people/{kind}/{user_id}")
async def finance_person(
    kind: str,
    user_id: str,
    start: datetime,
    end: datetime,
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await FinanceService(db).person(kind, user_id, start, end)


@router.get("/users/counts", response_model=UserCountsResponse)
async def user_counts(
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> UserCountsResponse:
    """Users per role and per status, for the numbers in the Users filter dropdowns."""
    return UserCountsResponse(**await AdminService(db).user_counts())


@router.get("/users/stats", response_model=NewUserStatsResponse)
async def new_user_stats(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    role: str | None = Query(default=None),
    bucket: str | None = Query(default=None, pattern="^(day|week|month)$"),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> NewUserStatsResponse:
    """How many new accounts joined in a period (Lagos dates): totals by role + a day/week/month
    series. Powers the "New users" panel on the admin Users page."""
    return NewUserStatsResponse(**await AdminService(db).new_user_stats(date_from, date_to, role, bucket))


@router.get("/users", response_model=PaginatedUsersResponse)
async def list_users(
    role: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
    date_from: date | None = Query(default=None, description="Joined on/after (Lagos date)"),
    date_to: date | None = Query(default=None, description="Joined on/before (Lagos date)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedUsersResponse:
    svc = AdminService(db)
    users, total = await svc.list_users(
        role=role, status=status, page=page, page_size=page_size, search=search,
        date_from=date_from, date_to=date_to,
    )
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
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    svc = AdminService(db)
    user, before = await svc.update_user_status(user_id, data.status)
    record_audit(db, current_user.user_id, "user.status", "user", user_id, {"status": before}, {"status": user.status})
    return _user_response(user)


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_admin_user(
    data: AdminCreateUserRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> UserResponse:
    svc = AuthService(db, redis)
    user = await svc.create_privileged_user(data)
    record_audit(db, current_user.user_id, "user.invite", "user", user.id, None, {"role": user.role, "email": user.email})
    return _user_response(user)


@router.post("/users/{user_id}/resend-invite", response_model=UserResponse)
async def resend_invite(
    user_id: str,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> UserResponse:
    """New link, new email; the old link stops working."""
    user = await AuthService(db, redis).resend_invite(user_id)
    record_audit(db, current_user.user_id, "user.invite_resend", "user", user_id)
    return _user_response(user)


@router.delete("/users/{user_id}/invite", status_code=204)
async def revoke_invite(
    user_id: str,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> None:
    await AuthService(db, redis).revoke_invite(user_id)
    # The account row is deleted on revoke, so the audit row keeps the id only as text.
    record_audit(db, current_user.user_id, "user.invite_revoke", "user", user_id)


# ── Vendor management ─────────────────────────────────────────────────────────

def _admin_vendor_response(vendor: object, missing: list[str] | None = None) -> AdminVendorResponse:
    from services.vendor.models import Vendor
    v: Vendor = vendor  # type: ignore[assignment]
    return AdminVendorResponse(
        missing=missing or [],
        id=str(v.id),
        user_id=str(v.user_id),
        name=v.name,
        slug=v.slug,
        description=v.description,
        logo_url=v.logo_url,
        status=v.status,
        zone_id=str(v.zone_id) if v.zone_id else None,
        address=v.address,
        **address_fields(v),
        rating=float(v.rating),
        review_count=v.review_count,
        created_at=v.created_at.isoformat(),
    )


@router.get("/vendors/counts", response_model=dict[str, int])
async def vendor_counts(
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Vendors per status plus how many have not filled all requirements: the numbers shown in the
    Vendors filter dropdown."""
    return await AdminService(db).vendor_counts()


@router.get("/vendors", response_model=PaginatedVendorsResponse)
async def list_vendors(
    status: str | None = Query(default=None),
    incomplete: bool = Query(default=False, description="Only vendors that have not filled all requirements"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedVendorsResponse:
    from sqlalchemy import select as _select

    from services.auth.models import User

    svc = AdminService(db)
    # "__all__" is the dropdown's placeholder for "no filter", never a real status.
    vendors, total = await svc.list_vendors(
        status=None if status in (None, "", "__all__") else status, page=page, page_size=page_size, incomplete=incomplete,
    )
    owners = {
        u.id: u for u in (await db.execute(_select(User).where(User.id.in_([v.user_id for v in vendors])))).scalars().all()
    } if vendors else {}
    items = []
    for v in vendors:
        checklist = svc.vendor_checklist(v, owners.get(v.user_id))
        items.append(_admin_vendor_response(v, [c["label"] for c in checklist if c["required"] and not c["ok"]]))
    return PaginatedVendorsResponse(items=items, total=total, page=page, page_size=page_size)


# ── Branches: requests to join a business, and tidy-up tools ────────────────────

@router.get("/branch-requests", response_model=list[BranchRequestResponse])
async def list_branch_requests(
    status: str | None = Query(default="pending", pattern="^(pending|approved|rejected|cancelled)$"),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> list[BranchRequestResponse]:
    from services.vendor import business as biz

    return [BranchRequestResponse(**r) for r in await biz.list_requests(db, status)]


@router.post("/branch-requests/{request_id}/approve", response_model=BusinessSummary)
async def approve_branch_request(
    request_id: str,
    data: ApproveBranchRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> BusinessSummary:
    from services.vendor import business as biz

    business = await biz.approve_request(db, request_id, current_user.user_id, data.business_name)
    record_audit(db, current_user.user_id, "business.link_approve", "business_request", request_id, None, {"business_id": str(business.id)})
    return BusinessSummary(**next(b for b in await biz.search_businesses(db, business.name) if b["id"] == str(business.id)))


@router.post("/branch-requests/{request_id}/reject", status_code=204)
async def reject_branch_request(
    request_id: str,
    data: RejectBranchRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    from services.vendor import business as biz

    await biz.reject_request(db, request_id, current_user.user_id, data.reason)
    record_audit(db, current_user.user_id, "business.link_reject", "business_request", request_id, None, {"reason": data.reason})


@router.get("/businesses", response_model=list[BusinessSummary])
async def list_businesses(
    search: str | None = Query(default=None, max_length=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> list[BusinessSummary]:
    from services.vendor import business as biz

    return [BusinessSummary(**b) for b in await biz.search_businesses(db, search)]


@router.patch("/businesses/{business_id}", response_model=BusinessSummary)
async def rename_business(
    business_id: str,
    data: RenameBusinessRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> BusinessSummary:
    from services.vendor import business as biz

    row = await biz.admin_rename(db, business_id, data.name)
    record_audit(db, current_user.user_id, "business.rename", "business", business_id, None, {"name": row.name})
    return BusinessSummary(**next(b for b in await biz.search_businesses(db, row.name) if b["id"] == business_id))


@router.put("/vendors/{vendor_id}/business", response_model=BusinessSummary)
async def set_vendor_business(
    vendor_id: str,
    data: SetVendorBusinessRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> BusinessSummary:
    """Link a vendor to a business (or start a new one from it): the fix for brands that were
    registered separately before this existed."""
    from services.vendor import business as biz

    row = await biz.admin_set_business(db, vendor_id, data.business_id, data.name)
    record_audit(db, current_user.user_id, "business.link", "vendor", vendor_id, None, {"business_id": str(row.id)})
    return BusinessSummary(**next(b for b in await biz.search_businesses(db, row.name) if b["id"] == str(row.id)))


@router.delete("/vendors/{vendor_id}/business", status_code=204)
async def unlink_vendor_business(
    vendor_id: str,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    from services.vendor import business as biz

    await biz.admin_unlink(db, vendor_id)
    record_audit(db, current_user.user_id, "business.unlink", "vendor", vendor_id, None, None)


@router.get("/vendors/{vendor_id}", response_model=AdminVendorProfileResponse)
async def get_vendor_profile(
    vendor_id: str,
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> AdminVendorProfileResponse:
    """The full profile of a vendor, with a checklist of what is filled in and what is missing,
    so an admin can decide on an application (or chase the vendor to fix it)."""
    return AdminVendorProfileResponse(**await AdminService(db).vendor_profile(vendor_id))


def _message_resp(m: object) -> VendorMessageResponse:
    from services.vendor.models import VendorMessage

    msg: VendorMessage = m  # type: ignore[assignment]
    return VendorMessageResponse(
        id=str(msg.id), sender_role=msg.sender_role, body=msg.body,
        created_at=msg.created_at.isoformat(), read=msg.read_at is not None,
    )


@router.get("/vendors/{vendor_id}/messages", response_model=list[VendorMessageResponse])
async def list_vendor_messages(
    vendor_id: str,
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> list[VendorMessageResponse]:
    from services.vendor.messages import list_thread

    vendor = await AdminService(db).get_vendor(vendor_id)
    return [_message_resp(m) for m in await list_thread(db, vendor.id, "admin")]


@router.post("/vendors/{vendor_id}/messages", response_model=VendorMessageResponse, status_code=201)
async def send_vendor_message(
    vendor_id: str,
    data: PostVendorMessageRequest,
    current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> VendorMessageResponse:
    """Message a vendor (e.g. about a missing pickup location). They get it in the app and portal,
    by push and by email, and can reply in the same thread."""
    from services.vendor.messages import post_message

    vendor = await AdminService(db).get_vendor(vendor_id)
    msg = await post_message(db, vendor, "admin", current_user.user_id, data.body)
    record_audit(db, current_user.user_id, "vendor.message", "vendor", vendor_id, None, {"length": len(msg.body)})
    return _message_resp(msg)


@router.patch("/vendors/{vendor_id}/status", response_model=AdminVendorResponse)
async def update_vendor_status(
    vendor_id: str,
    data: UpdateVendorStatusRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> AdminVendorResponse:
    svc = AdminService(db)
    vendor, before = await svc.update_vendor_status(vendor_id, data.status)
    record_audit(db, current_user.user_id, "vendor.status", "vendor", vendor_id, {"status": before}, {"status": vendor.status})
    return _admin_vendor_response(vendor)


# ── Product approval ──────────────────────────────────────────────────────────

def _admin_product_response(p: object) -> AdminProductResponse:
    from services.vendor.models import Product
    product: Product = p  # type: ignore[assignment]
    cat = getattr(product, "category", None)
    return AdminProductResponse(
        id=str(product.id),
        vendor_id=str(product.vendor_id),
        vendor_name=product.vendor.name,
        category_id=str(product.category_id) if product.category_id else None,
        category_name=cat.name if cat else None,
        name=product.name,
        description=product.description,
        image_urls=product.image_urls or [],
        stock_qty=product.stock_qty,
        approval_status=product.approval_status,
        rejection_reason=product.rejection_reason,
        vendor_price_kobo=product.vendor_price_kobo,
        price_kobo=product.price_kobo,
        compare_at_price_kobo=product.compare_at_price_kobo,
        discount_type=product.discount_type,
        discount_value=product.discount_value,
        markup_kobo=product.price_kobo - product.vendor_price_kobo,
        special_delivery_fee_kobo=product.special_delivery_fee_kobo,
        created_at=product.created_at.isoformat(),
    )


@router.get("/products/counts", response_model=dict[str, int])
async def product_counts(
    vendor_id: str | None = Query(default=None),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Products per approval status (PENDING / APPROVED / REJECTED), for the Products dropdown."""
    return await AdminService(db).product_counts(vendor_id)


@router.get("/products/vendors", response_model=PaginatedProductVendorsResponse)
async def list_product_vendors(
    search: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedProductVendorsResponse:
    """Vendors with their product counts (live / awaiting / rejected): the Products landing page."""
    items, total = await AdminService(db).product_vendor_summaries(search, page, page_size)
    return PaginatedProductVendorsResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/products", response_model=PaginatedAdminProductsResponse)
async def list_products(
    approval_status: str | None = Query(default=None, pattern="^(PENDING|APPROVED|REJECTED)$"),
    vendor_id: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAdminProductsResponse:
    products, total = await AdminService(db).list_products(approval_status, vendor_id, page, page_size, search)
    return PaginatedAdminProductsResponse(
        items=[_admin_product_response(p) for p in products], total=total, page=page, page_size=page_size
    )


@router.post("/products/{product_id}/approve", response_model=AdminProductResponse)
async def approve_product(
    product_id: str,
    data: ApproveProductRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> AdminProductResponse:
    """Approve a product and set the price customers will see. Also re-prices a live product."""
    product = await AdminService(db).approve_product(
        product_id, data.price_kobo, data.discount_type, data.discount_value, data.special_delivery_fee_kobo
    )
    record_audit(
        db, current_user.user_id, "product.approve", "product", product_id, None,
        {"price_kobo": data.price_kobo, "discount_type": data.discount_type,
         "discount_value": data.discount_value, "special_delivery_fee_kobo": data.special_delivery_fee_kobo},
    )
    return _admin_product_response(product)


@router.post("/products/{product_id}/reject", response_model=AdminProductResponse)
async def reject_product(
    product_id: str,
    data: RejectProductRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> AdminProductResponse:
    product = await AdminService(db).reject_product(product_id, data.reason)
    record_audit(db, current_user.user_id, "product.reject", "product", product_id, None, {"reason": data.reason})
    return _admin_product_response(product)


@router.patch("/products/{product_id}/category", response_model=AdminProductResponse)
async def set_product_category(
    product_id: str,
    data: SetProductCategoryRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> AdminProductResponse:
    """Fix a product's category at any time (e.g. the vendor put it in the wrong one)."""
    product, before = await AdminService(db).set_product_category(product_id, data.category_id)
    record_audit(
        db, current_user.user_id, "product.category", "product", product_id,
        {"category_id": before}, {"category_id": data.category_id},
    )
    return _admin_product_response(product)


# ── Order management ──────────────────────────────────────────────────────────

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


async def _rider_info(db: AsyncSession, orders: list) -> dict:
    """{rider_id: (name, phone)} for the riders on these orders, in one query."""
    from sqlalchemy import select

    from services.auth.models import User
    from services.dispatch.models import Rider

    rider_ids = list({o.rider_id for o in orders if o.rider_id})
    if not rider_ids:
        return {}
    rows = await db.execute(
        select(Rider.id, User.name, User.phone)
        .join(User, User.id == Rider.user_id)
        .where(Rider.id.in_(rider_ids))
    )
    return {rid: (name, phone) for rid, name, phone in rows.all()}


async def _party_info(db: AsyncSession, orders: list) -> dict:
    """Contact details for each order's customer and vendor, in two queries."""
    from sqlalchemy import select

    from services.auth.models import User
    from services.vendor.models import Vendor

    customer_ids = list({o.customer_id for o in orders})
    vendor_ids = list({o.vendor_id for o in orders})
    customers: dict = {}
    vendors: dict = {}
    if customer_ids:
        rows = await db.execute(select(User.id, User.name, User.phone, User.email).where(User.id.in_(customer_ids)))
        customers = {i: (n, p, e) for i, n, p, e in rows.all()}
    if vendor_ids:
        rows = await db.execute(
            select(Vendor.id, Vendor.name, User.phone, User.email)
            .join(User, User.id == Vendor.user_id)
            .where(Vendor.id.in_(vendor_ids))
        )
        vendors = {i: (n, p, e) for i, n, p, e in rows.all()}
    return {"customers": customers, "vendors": vendors}


def _party_fields(parties: dict | None, o: object) -> dict:
    from services.orders.models import Order
    order: Order = o  # type: ignore[assignment]
    out: dict = {}
    if parties:
        c = parties["customers"].get(order.customer_id)
        v = parties["vendors"].get(order.vendor_id)
        if c:
            out.update(customer_name=c[0], customer_phone=c[1], customer_email=c[2])
        if v:
            out.update(vendor_name=v[0], vendor_phone=v[1], vendor_email=v[2])
    # Orders from before vendor prices / the delivery commission have no snapshot to work from.
    if order.vendor_total_kobo is not None:
        out["platform_product_gain_kobo"] = order.total_kobo - order.vendor_total_kobo
    if order.rider_fee_kobo is not None:
        out["platform_delivery_gain_kobo"] = order.delivery_fee_kobo - order.rider_fee_kobo
    if order.vendor_total_kobo is not None:
        out["vendor_earning_kobo"] = order.vendor_total_kobo
    out["rider_earning_kobo"] = order.delivery_fee_kobo if order.rider_fee_kobo is None else order.rider_fee_kobo
    return out


async def _hub_info(db: AsyncSession, orders: list) -> dict:
    """{hub_id: AgentHub} for the hubs on these orders, in one query."""
    from sqlalchemy import select

    from services.qa.models import AgentHub

    hub_ids = list({o.hub_id for o in orders if o.hub_id})
    if not hub_ids:
        return {}
    rows = await db.execute(select(AgentHub).where(AgentHub.id.in_(hub_ids)))
    return {h.id: h for h in rows.scalars().all()}


def _hub_fields(hubs: dict | None, hub_id: object) -> dict:
    hub = (hubs or {}).get(hub_id)
    if hub is None:
        return {}
    return {
        "hub_name": hub.name,
        "hub_lat": float(hub.lat) if hub.lat is not None else None,
        "hub_lng": float(hub.lng) if hub.lng is not None else None,
        "hub_address": hub.address,
        "hub_description": hub.description,
    }


def _order_resp(
    order: object, riders: dict | None = None, hubs: dict | None = None, parties: dict | None = None
) -> OrderResponse:
    from services.orders.models import Order
    o: Order = order  # type: ignore[assignment]
    return OrderResponse(
        id=str(o.id),
        customer_id=str(o.customer_id),
        vendor_id=str(o.vendor_id),
        rider_id=str(o.rider_id) if o.rider_id else None,
        rider_name=(riders or {}).get(o.rider_id, (None, None))[0],
        rider_phone=(riders or {}).get(o.rider_id, (None, None))[1],
        hub_id=str(o.hub_id) if o.hub_id else None,
        **_hub_fields(hubs, o.hub_id),
        **_party_fields(parties, o),
        status=o.status,
        total_kobo=o.total_kobo,
        delivery_fee_kobo=o.delivery_fee_kobo,
        delivery_quote=o.delivery_quote,
        delivery_address=o.delivery_address,
        items=[_item_resp(i) for i in (o.items or [])],
        created_at=o.created_at.isoformat(),
        updated_at=o.updated_at.isoformat(),
    )


def _order_detail_resp(
    order: object, riders: dict | None = None, hubs: dict | None = None, parties: dict | None = None
) -> OrderDetailResponse:
    from services.orders.models import Order
    o: Order = order  # type: ignore[assignment]
    return OrderDetailResponse(
        id=str(o.id),
        customer_id=str(o.customer_id),
        vendor_id=str(o.vendor_id),
        rider_id=str(o.rider_id) if o.rider_id else None,
        rider_name=(riders or {}).get(o.rider_id, (None, None))[0],
        rider_phone=(riders or {}).get(o.rider_id, (None, None))[1],
        hub_id=str(o.hub_id) if o.hub_id else None,
        **_hub_fields(hubs, o.hub_id),
        **_party_fields(parties, o),
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


@router.get("/orders/status-counts", response_model=dict[str, int])
async def order_status_counts(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Orders per exact status in a period (Lagos dates), for the numbers in the status dropdown."""
    return await AdminService(db).order_status_counts(date_from, date_to)


@router.get("/orders/stats", response_model=OrderStatsResponse)
async def order_stats(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    group: str | None = Query(default=None),
    bucket: str | None = Query(default=None, pattern="^(day|week|month)$"),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> OrderStatsResponse:
    """How many orders were placed in a period (Lagos dates): counts per status group (awaiting
    payment, in progress, delivered, release pending, completed, cancelled, disputes) plus a
    day/week/month series. Powers the "Order numbers" panel on the admin Orders page."""
    return OrderStatsResponse(**await AdminService(db).order_stats(date_from, date_to, group, bucket))


@router.get("/orders", response_model=PaginatedOrdersResponse)
async def list_all_orders(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=64, description="Order ID (start of it)"),
    date_from: date | None = Query(default=None, description="Placed on/after (Lagos date)"),
    date_to: date | None = Query(default=None, description="Placed on/before (Lagos date)"),
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
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    riders = await _rider_info(db, orders)
    hubs = await _hub_info(db, orders)
    parties = await _party_info(db, orders)
    return PaginatedOrdersResponse(
        items=[_order_resp(o, riders, hubs, parties) for o in orders],
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
    return _order_detail_resp(
        order, await _rider_info(db, [order]), await _hub_info(db, [order]), await _party_info(db, [order])
    )


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
    return _order_resp(
        order, await _rider_info(db, [order]), await _hub_info(db, [order]), await _party_info(db, [order])
    )


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


@router.get("/audit-log", response_model=PaginatedAuditLogResponse)
async def get_audit_log(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAuditLogResponse:
    from services.analytics.schemas import AuditLogEntryResponse
    from services.analytics.service import AnalyticsService
    entries, total = await AnalyticsService(db).list_audit_log(page, page_size)
    return PaginatedAuditLogResponse(
        items=[
            AuditLogEntryResponse(
                id=str(e.id),
                admin_id=str(e.actor_id),
                action=e.action,
                resource=e.target_type,
                resource_id=e.target_id,
                metadata=e.after,
                created_at=e.created_at.isoformat(),
            )
            for e in entries
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


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
        address=h.address,
        **address_fields(h),
        description=h.description,
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
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> HubResponse:
    svc = AdminService(db)
    hub = await svc.create_hub(data.name, data.capacity, data.lat, data.lng)
    record_audit(db, current_user.user_id, "hub.create", "hub", hub.id, None, {"name": data.name, "capacity": data.capacity})
    return _hub_resp(hub)


@router.patch("/hubs/{hub_id}", response_model=HubResponse)
async def update_hub(
    hub_id: str,
    data: UpdateHubRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> HubResponse:
    svc = AdminService(db)
    hub = await svc.update_hub(hub_id, data.name, data.capacity)
    record_audit(db, current_user.user_id, "hub.update", "hub", hub_id, None, {"name": data.name, "capacity": data.capacity})
    return _hub_resp(hub)


@router.delete("/hubs/{hub_id}", status_code=204)
async def delete_hub(
    hub_id: str,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    svc = AdminService(db)
    await svc.delete_hub(hub_id)
    record_audit(db, current_user.user_id, "hub.delete", "hub", hub_id)


@router.patch("/users/{user_id}/hub", response_model=UserResponse)
async def assign_agent_hub(
    user_id: str,
    data: AssignHubRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    svc = AdminService(db)
    user = await svc.assign_agent_hub(user_id, data.hub_id)
    record_audit(db, current_user.user_id, "user.hub_assign", "user", user_id, None, {"hub_id": data.hub_id})
    return _user_response(user)
