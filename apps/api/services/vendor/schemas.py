from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ── Product ──────────────────────────────────────────────────────────────────

class ProductResponse(BaseModel):
    id: str
    vendor_id: str
    name: str
    description: str | None
    price_kobo: int
    available: bool
    stock_qty: int
    image_urls: list[str]

    model_config = {"from_attributes": True}


class CreateProductRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    price_kobo: int = Field(gt=0, description="Price in kobo (must be > 0)")
    stock_qty: int = Field(default=0, ge=0)
    image_urls: list[str] = Field(default_factory=list)


class UpdateProductRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price_kobo: int | None = Field(default=None, gt=0)
    stock_qty: int | None = Field(default=None, ge=0)
    image_urls: list[str] | None = None


class UpdateProductAvailabilityRequest(BaseModel):
    available: bool


# ── Vendor ────────────────────────────────────────────────────────────────────

class VendorResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    logo_url: str | None
    status: str
    zone_id: str | None
    rating: float
    created_at: str

    model_config = {"from_attributes": True}

    @field_validator("zone_id", mode="before")
    @classmethod
    def uuid_to_str(cls, v: object) -> str | None:
        if v is None:
            return None
        return str(v)

    @field_validator("rating", mode="before")
    @classmethod
    def decimal_to_float(cls, v: object) -> float:
        return float(v)  # type: ignore[arg-type]


class VendorDetailResponse(VendorResponse):
    products: list[ProductResponse] = []
    has_payout_account: bool = False
    payout_bank_name: str | None = None
    payout_account_name: str | None = None


class UpdateVendorProfileRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    logo_url: str | None = None


class PaginatedVendorsResponse(BaseModel):
    items: list[VendorResponse]
    total: int
    page: int
    page_size: int


# ── Payout account ───────────────────────────────────────────────────────────

class BankResponse(BaseModel):
    name: str
    code: str


class VerifyAccountRequest(BaseModel):
    account_number: str = Field(min_length=10, max_length=10, pattern=r"^\d{10}$")
    bank_code: str = Field(min_length=1)


class VerifyAccountResponse(BaseModel):
    account_name: str
    account_number: str


class SavePayoutAccountRequest(BaseModel):
    account_number: str = Field(min_length=10, max_length=10, pattern=r"^\d{10}$")
    bank_code: str = Field(min_length=1)
    bank_name: str = Field(min_length=1)
    account_name: str = Field(min_length=1)


class PayoutAccountResponse(BaseModel):
    has_payout_account: bool
    account_number: str | None
    bank_name: str | None
    account_name: str | None


# ── Admin ─────────────────────────────────────────────────────────────────────

class UpdateVendorStatusRequest(BaseModel):
    status: Literal["active", "suspended", "rejected"]


class AdminVendorResponse(VendorResponse):
    user_id: str

    @field_validator("user_id", mode="before")
    @classmethod
    def user_id_to_str(cls, v: object) -> str:
        return str(v)
