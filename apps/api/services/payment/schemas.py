from __future__ import annotations

from pydantic import BaseModel, Field


class InitiatePaymentResponse(BaseModel):
    payment_url: str
    reference: str
    escrow_id: str


class EscrowStatusResponse(BaseModel):
    id: str
    order_id: str
    provider: str
    provider_ref: str
    amount_kobo: int
    status: str
    created_at: str

    model_config = {"from_attributes": True}


class RefundRequest(BaseModel):
    amount_kobo: int = Field(gt=0, description="Amount to refund in kobo")
    reason: str = Field(min_length=1)
