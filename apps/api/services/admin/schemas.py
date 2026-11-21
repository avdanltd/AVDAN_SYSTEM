# Admin-specific schemas. Shared response types are in services.auth.schemas.
from typing import Literal

from pydantic import BaseModel, Field

from services.vendor.schemas import LinkRequestInfo, MyBusiness

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


# ── Vendor profile (application review) and the admin <-> vendor conversation ───────────────

class VendorChecklistItem(BaseModel):
    key: str
    label: str
    ok: bool
    # A required item that is not ok is what the admin should chase before approving.
    required: bool = True
    detail: str | None = None


class AdminVendorProfileResponse(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    description: str | None
    logo_url: str | None
    is_open: bool
    created_at: str
    address: str | None = None
    street: str | None = None
    city: str | None = None
    lga: str | None = None
    state: str | None = None
    country: str | None = None
    landmark: str | None = None
    lat: float | None = None
    lng: float | None = None
    owner_name: str | None = None
    owner_email: str | None = None
    owner_phone: str | None = None
    owner_status: str | None = None
    payout_bank_name: str | None = None
    payout_account_name: str | None = None
    payout_account_last4: str | None = None  # never the full number
    product_total: int = 0
    product_approved: int = 0
    product_pending: int = 0
    checklist: list[VendorChecklistItem]
    missing: list[str]  # labels of required items that are not done
    unread_from_vendor: int = 0
    # The business this store belongs to (and its branches), and the latest request to join one.
    business: MyBusiness | None = None
    link_request: LinkRequestInfo | None = None



class AdminProductVendorSummary(BaseModel):
    """One row of the admin Products landing page: a vendor and what they have listed."""

    vendor_id: str
    name: str
    status: str
    logo_url: str | None = None
    total: int
    live: int
    pending: int
    rejected: int


class PaginatedProductVendorsResponse(BaseModel):
    items: list[AdminProductVendorSummary]
    total: int
    page: int
    page_size: int


# ── Branch link requests and businesses ────────────────────────────────────────

class BranchRequestResponse(BaseModel):
    id: str
    status: str
    note: str | None = None
    reason: str | None = None
    target_name: str | None = None
    created_at: str
    vendor_id: str
    vendor_name: str
    vendor_place: str
    vendor_status: str
    hints: list[str] = []  # things that suggest the vendor really belongs (or not); a person decides


class ApproveBranchRequest(BaseModel):
    business_name: str | None = Field(default=None, max_length=255)


class RejectBranchRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class BusinessBranchSummary(BaseModel):
    vendor_id: str
    name: str
    place: str


class BusinessSummary(BaseModel):
    id: str
    name: str
    slug: str
    branch_count: int
    branches: list[BusinessBranchSummary]


class SetVendorBusinessRequest(BaseModel):
    business_id: str | None = None  # null = start a new business from this vendor
    name: str | None = Field(default=None, max_length=255)


class RenameBusinessRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)


class UserCountsResponse(BaseModel):
    total: int
    by_role: dict[str, int]
    by_status: dict[str, int]
