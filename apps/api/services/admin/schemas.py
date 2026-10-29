# Admin-specific schemas. Shared response types are in services.auth.schemas.
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
    # price_kobo - vendor_price_kobo: the platform's gain per unit sold.
    markup_kobo: int
    created_at: str


class PaginatedAdminProductsResponse(BaseModel):
    items: list[AdminProductResponse]
    total: int
    page: int
    page_size: int


class ApproveProductRequest(BaseModel):
    price_kobo: int = Field(gt=0, description="Price customers will see and pay, in kobo")


class RejectProductRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
