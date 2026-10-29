# Admin-specific schemas. Shared response types are in services.auth.schemas.
from typing import Literal

from pydantic import BaseModel, Field


# ── Product approval ─────────────────────────────────────────────────────────

class AdminProductResponse(BaseModel):
    id: str
    vendor_id: str
    vendor_name: str
    category_name: str | None
    name: str
    description: str | None
    image_urls: list[str]
    stock_qty: int
    approval_status: str
    rejection_reason: str | None
    vendor_price_kobo: int
    # What customers see and pay once approved; equal to the vendor price until a markup is set.
    price_kobo: int
    # The price before discount (null when there is none), and the discount as entered.
    compare_at_price_kobo: int | None
    discount_type: str | None
    discount_value: int | None
    # price_kobo - vendor_price_kobo: the platform's gain per unit sold.
    markup_kobo: int
    created_at: str


class PaginatedAdminProductsResponse(BaseModel):
    items: list[AdminProductResponse]
    total: int
    page: int
    page_size: int


class ApproveProductRequest(BaseModel):
    price_kobo: int = Field(gt=0, description="Shown (marked-up) price in kobo, before any discount")
    discount_type: Literal["FIXED", "PERCENT"] | None = None
    discount_value: int | None = Field(default=None, gt=0, description="Kobo if FIXED, whole percent if PERCENT")


class RejectProductRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
