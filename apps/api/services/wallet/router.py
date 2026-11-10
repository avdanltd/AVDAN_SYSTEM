from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from services.wallet.models import PayoutRequest, PayoutRequestEvent, WalletEntry
from services.wallet.schemas import (
    ApprovePayoutRequest,
    CreatePayoutRequest,
    PaginatedPayoutRequestsResponse,
    PaginatedWalletEntriesResponse,
    PayoutEventResponse,
    PayoutPinStatusResponse,
    PayoutRequestResponse,
    RejectPayoutRequest,
    SetPayoutPinRequest,
    WalletEntryResponse,
    WalletSummaryResponse,
)
from services.wallet.service import WalletService

# Vendors and riders share one wallet API — the caller's role decides whose wallet it is.
router = APIRouter()
# Admin review queue, mounted at /admin/payouts.
admin_router = APIRouter()


def _iso(dt: object) -> str | None:
    return dt.isoformat() if dt else None  # type: ignore[attr-defined]


def _request_resp(
    r: PayoutRequest,
    names: dict | None = None,
    events: list[PayoutRequestEvent] | None = None,
    summary: dict | None = None,
    admin_names: dict | None = None,
) -> PayoutRequestResponse:
    """`admin_names` is passed only by admin routes. Who approved a payout is internal: owners
    get neither the admin's id nor their name."""
    return PayoutRequestResponse(
        id=str(r.id),
        owner_type=r.owner_type,
        owner_id=str(r.owner_id),
        owner_name=(names or {}).get(r.owner_id),
        requested_kobo=r.requested_kobo,
        approved_kobo=r.approved_kobo,
        status=r.status,
        destination=r.destination,
        decided_by=str(r.decided_by) if (admin_names is not None and r.decided_by) else None,
        decided_by_name=(admin_names or {}).get(r.decided_by) if r.decided_by else None,
        decided_at=_iso(r.decided_at),
        decision_note=r.decision_note,
        paid_at=_iso(r.paid_at),
        failure_reason=r.failure_reason,
        created_at=r.created_at.isoformat(),
        events=None if events is None else [
            PayoutEventResponse(
                id=str(e.id), event=e.event, actor_id=str(e.actor_id) if e.actor_id else None,
                actor_role=e.actor_role, amount_kobo=e.amount_kobo, note=e.note,
                created_at=e.created_at.isoformat(),
            ) for e in events
        ],
        owner_available_kobo=summary["available_kobo"] if summary else None,
        owner_lifetime_earned_kobo=summary["lifetime_earned_kobo"] if summary else None,
    )


def _entry_resp(e: WalletEntry) -> WalletEntryResponse:
    return WalletEntryResponse(
        id=str(e.id), kind=e.kind, amount_kobo=e.amount_kobo,
        order_id=str(e.order_id) if e.order_id else None,
        payout_request_id=str(e.payout_request_id) if e.payout_request_id else None,
        metadata=e.entry_metadata, created_at=e.created_at.isoformat(),
    )


# ── Vendor / rider ────────────────────────────────────────────────────────────

@router.get("/me", response_model=WalletSummaryResponse)
async def get_my_wallet(
    current_user: CurrentUser = Depends(require_role("vendor", "rider")),
    db: AsyncSession = Depends(get_db),
) -> WalletSummaryResponse:
    return WalletSummaryResponse(**await WalletService(db).my_summary(current_user.role, current_user.user_id))


@router.get("/me/entries", response_model=PaginatedWalletEntriesResponse)
async def list_my_wallet_entries(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_role("vendor", "rider")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedWalletEntriesResponse:
    entries, total = await WalletService(db).list_entries(current_user.role, current_user.user_id, page, page_size)
    return PaginatedWalletEntriesResponse(
        items=[_entry_resp(e) for e in entries], total=total, page=page, page_size=page_size
    )


@router.post("/me/payout-requests", response_model=PayoutRequestResponse, status_code=201)
async def request_withdrawal(
    data: CreatePayoutRequest,
    current_user: CurrentUser = Depends(require_role("vendor", "rider")),
    db: AsyncSession = Depends(get_db),
) -> PayoutRequestResponse:
    request = await WalletService(db).request_withdrawal(current_user.role, current_user.user_id, data.amount_kobo)
    return _request_resp(request)


@router.get("/me/payout-requests", response_model=PaginatedPayoutRequestsResponse)
async def list_my_payout_requests(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_role("vendor", "rider")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedPayoutRequestsResponse:
    requests, total = await WalletService(db).list_my_requests(
        current_user.role, current_user.user_id, page, page_size
    )
    return PaginatedPayoutRequestsResponse(
        items=[_request_resp(r) for r in requests], total=total, page=page, page_size=page_size,
        pending_count=0, pending_kobo=0,
    )


# ── Admin ─────────────────────────────────────────────────────────────────────

@admin_router.get("", response_model=PaginatedPayoutRequestsResponse)
async def admin_list_payout_requests(
    status: str | None = None,
    owner_type: str | None = Query(default=None, pattern="^(vendor|rider)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedPayoutRequestsResponse:
    svc = WalletService(db)
    requests, total, pending_count, pending_kobo = await svc.admin_list_requests(status, owner_type, page, page_size)
    names = await svc.owner_names(requests)
    admins = await svc.admin_names(requests)
    return PaginatedPayoutRequestsResponse(
        items=[_request_resp(r, names, admin_names=admins) for r in requests],
        total=total, page=page, page_size=page_size,
        pending_count=pending_count, pending_kobo=pending_kobo,
    )


@admin_router.get("/pin", response_model=PayoutPinStatusResponse)
async def admin_payout_pin_status(
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> PayoutPinStatusResponse:
    return PayoutPinStatusResponse(is_set=await WalletService(db).payout_pin_is_set(current_user.user_id))


@admin_router.put("/pin", response_model=PayoutPinStatusResponse)
async def admin_set_payout_pin(
    data: SetPayoutPinRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> PayoutPinStatusResponse:
    await WalletService(db).set_payout_pin(current_user.user_id, data.pin, data.current_password)
    return PayoutPinStatusResponse(is_set=True)


@admin_router.get("/{request_id}", response_model=PayoutRequestResponse)
async def admin_get_payout_request(
    request_id: str,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> PayoutRequestResponse:
    svc = WalletService(db)
    request, events, summary = await svc.admin_get_request(request_id)
    return _request_resp(
        request, await svc.owner_names([request]), events, summary, admin_names=await svc.admin_names([request])
    )


@admin_router.post("/{request_id}/approve", response_model=PayoutRequestResponse)
async def admin_approve_payout_request(
    request_id: str,
    data: ApprovePayoutRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> PayoutRequestResponse:
    svc = WalletService(db)
    # The PIN is checked before anything is touched; a wrong PIN never reaches Paystack.
    await svc.verify_payout_pin(current_user.user_id, data.pin)
    request = await svc.approve(request_id, current_user.user_id, data.approved_kobo, data.note)
    return _request_resp(request, await svc.owner_names([request]), admin_names=await svc.admin_names([request]))


@admin_router.post("/{request_id}/refresh", response_model=PayoutRequestResponse)
async def admin_refresh_payout_request(
    request_id: str,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> PayoutRequestResponse:
    """Ask Paystack for the transfer's real status and settle the payout — for when the webhook
    never arrived."""
    svc = WalletService(db)
    request = await svc.reconcile_request(request_id)
    return _request_resp(request, await svc.owner_names([request]), admin_names=await svc.admin_names([request]))


@admin_router.post("/{request_id}/reject", response_model=PayoutRequestResponse)
async def admin_reject_payout_request(
    request_id: str,
    data: RejectPayoutRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> PayoutRequestResponse:
    svc = WalletService(db)
    request = await svc.reject(request_id, current_user.user_id, data.note)
    return _request_resp(request, await svc.owner_names([request]), admin_names=await svc.admin_names([request]))
