# Admin-specific schemas. Shared response types are in services.auth.schemas.
from typing import Literal

from pydantic import BaseModel, Field

# ── Product approval ─────────────────────────────────────────────────────────

class AdminProductResponse(BaseModel):
    id: str
    vendor_id: str
    vendor_name: str
    category_id: str | None = None
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
    # Extra delivery charge per unit (0 = none), on top of the normal delivery fee.
    special_delivery_fee_kobo: int = 0
    created_at: str


class PaginatedAdminProductsResponse(BaseModel):
    items: list[AdminProductResponse]
    total: int
    page: int
    page_size: int


class AttentionResponse(BaseModel):
    """How many items in each admin section are waiting on a person. Drives the badges in the menu."""
    products: int
    vendors: int
    payouts: int
    disputes: int
    dispatch: int


class ApproveProductRequest(BaseModel):
    price_kobo: int = Field(gt=0, description="Shown (marked-up) price in kobo, before any discount")
    discount_type: Literal["FIXED", "PERCENT"] | None = None
    discount_value: int | None = Field(default=None, gt=0, description="Kobo if FIXED, whole percent if PERCENT")
    # Per-unit extra delivery charge in kobo; omit to leave unchanged, 0 to clear.
    special_delivery_fee_kobo: int | None = Field(default=None, ge=0, le=100_000_000)


class RejectProductRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class NewUserPoint(BaseModel):
    bucket: str  # first day of the day / week / month, YYYY-MM-DD (Lagos time)
    total: int
    by_role: dict[str, int]


class NewUserStatsResponse(BaseModel):
    date_from: str
    date_to: str
    bucket: str  # "day" | "week" | "month"
    total: int
    active: int  # of those, how many have verified / set up their account
    by_role: dict[str, int]
    series: list[NewUserPoint]


class OrderGroupCount(BaseModel):
    key: str
    label: str
    statuses: list[str]
    count: int


class OrderStatsPoint(BaseModel):
    bucket: str  # first day of the day / week / month, YYYY-MM-DD (Lagos time)
    total: int
    by_group: dict[str, int]


class OrderStatsResponse(BaseModel):
    date_from: str
    date_to: str
    bucket: str  # "day" | "week" | "month"
    total: int
    value_kobo: int  # gross value (goods + delivery) of the orders that were actually paid for
    groups: list[OrderGroupCount]
    series: list[OrderStatsPoint]


class SetProductCategoryRequest(BaseModel):
    category_id: str | None = None  # null = no category
