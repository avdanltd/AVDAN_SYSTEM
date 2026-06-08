from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RaiseDisputeRequest(BaseModel):
    order_id: str
    reason: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=10)
    evidence_urls: list[str] = Field(default_factory=list)


class DisputeResponse(BaseModel):
    id: str
    order_id: str
    raised_by: str
    reason: str
    description: str
    evidence_urls: list[str]
    status: str
    resolution: str | None
    resolution_notes: str | None
    resolved_at: str | None
    created_at: str

    model_config = {"from_attributes": True}


class ResolveDisputeRequest(BaseModel):
    resolution: Literal["release_to_vendor", "refund_to_customer", "split"]
    notes: str = Field(min_length=1)
    # Required only for "split" resolution
    vendor_amount_kobo: int | None = Field(default=None, gt=0)
    refund_amount_kobo: int | None = Field(default=None, gt=0)


class PaginatedDisputesResponse(BaseModel):
    items: list[DisputeResponse]
    total: int
    page: int
    page_size: int
