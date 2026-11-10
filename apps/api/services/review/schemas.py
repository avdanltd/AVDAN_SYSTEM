from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class ReviewInput(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)

    @field_validator("comment", mode="before")
    @classmethod
    def _blank_to_none(cls, v: object) -> object:
        return (v.strip() or None) if isinstance(v, str) else v


class ProductReviewInput(ReviewInput):
    product_id: str


class SubmitReviewsRequest(BaseModel):
    """Everything the customer rated on one order, sent together. Either part is optional,
    but at least one review is required."""

    vendor: ReviewInput | None = None
    products: list[ProductReviewInput] = Field(default_factory=list, max_length=50)


class ReviewResponse(BaseModel):
    id: str
    target_type: str
    product_id: str | None
    product_name: str | None = None
    rating: int
    comment: str | None
    reviewer_name: str  # "Ada O." — never the full name
    verified_purchase: bool = True
    created_at: str


class OrderProductReview(BaseModel):
    product_id: str
    product_name: str
    image_url: str | None
    review: ReviewResponse | None


class OrderReviewsResponse(BaseModel):
    """What the customer can still review on an order, and what they already did."""

    eligible: bool
    reason: str | None
    vendor_name: str | None
    vendor: ReviewResponse | None
    products: list[OrderProductReview]


class ReviewSummary(BaseModel):
    average: float
    count: int
    distribution: dict[str, int]  # "1".."5" -> how many


class PaginatedReviewsResponse(BaseModel):
    items: list[ReviewResponse]
    total: int
    page: int
    page_size: int
    summary: ReviewSummary


class AdminReviewResponse(BaseModel):
    id: str
    target_type: str
    rating: int
    comment: str | None
    status: str
    order_id: str
    order_outcome: str
    customer_name: str | None
    vendor_name: str | None
    product_name: str | None
    hidden_reason: str | None
    hidden_by_name: str | None
    created_at: str


class PaginatedAdminReviewsResponse(BaseModel):
    items: list[AdminReviewResponse]
    total: int
    page: int
    page_size: int


class HideReviewRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
