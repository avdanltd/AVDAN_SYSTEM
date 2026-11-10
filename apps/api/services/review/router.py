from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from services.review.schemas import (
    AdminReviewResponse,
    HideReviewRequest,
    OrderReviewsResponse,
    PaginatedAdminReviewsResponse,
    PaginatedReviewsResponse,
    SubmitReviewsRequest,
)
from services.review.service import ReviewService

# Customer + public reads, mounted at /reviews.
router = APIRouter()
# Moderation, mounted at /admin/reviews.
admin_router = APIRouter()


@router.get("/orders/{order_id}", response_model=OrderReviewsResponse)
async def get_order_reviews(
    order_id: str,
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> OrderReviewsResponse:
    """What the customer can review on this order and what they already reviewed."""
    return OrderReviewsResponse(**await ReviewService(db).get_order_reviews(order_id, current_user.user_id))


@router.post("/orders/{order_id}", response_model=OrderReviewsResponse, status_code=201)
async def submit_order_reviews(
    order_id: str,
    data: SubmitReviewsRequest,
    current_user: CurrentUser = Depends(require_role("customer")),
    db: AsyncSession = Depends(get_db),
) -> OrderReviewsResponse:
    """Rate the vendor and/or products of an ended order. Each can be rated once."""
    return OrderReviewsResponse(**await ReviewService(db).submit(order_id, current_user.user_id, data))


@router.get("/products/{product_id}", response_model=PaginatedReviewsResponse)
async def list_product_reviews(
    product_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> PaginatedReviewsResponse:
    return PaginatedReviewsResponse(**await ReviewService(db).list_product_reviews(product_id, page, page_size))


@router.get("/vendors/{vendor_id}", response_model=PaginatedReviewsResponse)
async def list_vendor_reviews(
    vendor_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> PaginatedReviewsResponse:
    return PaginatedReviewsResponse(**await ReviewService(db).list_vendor_reviews(vendor_id, page, page_size))


@admin_router.get("", response_model=PaginatedAdminReviewsResponse)
async def admin_list_reviews(
    status: str | None = Query(default=None, pattern="^(visible|hidden)$"),
    target_type: str | None = Query(default=None, pattern="^(product|vendor)$"),
    max_rating: int | None = Query(default=None, ge=1, le=5),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAdminReviewsResponse:
    return PaginatedAdminReviewsResponse(
        **await ReviewService(db).admin_list(status, target_type, max_rating, page, page_size)
    )


@admin_router.post("/{review_id}/hide", response_model=AdminReviewResponse)
async def admin_hide_review(
    review_id: str,
    data: HideReviewRequest,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> AdminReviewResponse:
    """Take a review down (abuse, spam, wrong target). It stops counting toward averages."""
    svc = ReviewService(db)
    review = await svc.hide(review_id, current_user.user_id, data.reason)
    return AdminReviewResponse(**await svc.admin_one(review))


@admin_router.post("/{review_id}/unhide", response_model=AdminReviewResponse)
async def admin_unhide_review(
    review_id: str,
    current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> AdminReviewResponse:
    svc = ReviewService(db)
    review = await svc.unhide(review_id, current_user.user_id)
    return AdminReviewResponse(**await svc.admin_one(review))
