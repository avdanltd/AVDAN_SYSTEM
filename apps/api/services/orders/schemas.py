from __future__ import annotations

from pydantic import BaseModel, Field


# ── Shared sub-objects ────────────────────────────────────────────────────────

class DeliveryAddress(BaseModel):
    street: str = Field(min_length=1)
    city: str = Field(min_length=1)
    state: str = Field(min_length=1)
    country: str = "Nigeria"
    notes: str | None = None


# ── Order items ───────────────────────────────────────────────────────────────

class OrderItemRequest(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


class OrderItemResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    price_kobo: int
    quantity: int
    subtotal_kobo: int

    model_config = {"from_attributes": True}


# ── Order events ──────────────────────────────────────────────────────────────

class OrderEventResponse(BaseModel):
    id: str
    from_state: str | None
    to_state: str
    actor_role: str | None
    metadata: dict | None
    created_at: str

    model_config = {"from_attributes": True}


# ── Order ─────────────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    vendor_id: str
    items: list[OrderItemRequest] = Field(min_length=1)
    delivery_address: DeliveryAddress


class OrderResponse(BaseModel):
    id: str
    customer_id: str
    vendor_id: str
    status: str
    total_kobo: int
    delivery_address: dict
    items: list[OrderItemResponse] = []
    created_at: str

    model_config = {"from_attributes": True}


class OrderDetailResponse(OrderResponse):
    events: list[OrderEventResponse] = []


class PaginatedOrdersResponse(BaseModel):
    items: list[OrderResponse]
    total: int
    page: int
    page_size: int


# ── Vendor actions ────────────────────────────────────────────────────────────

class RejectOrderRequest(BaseModel):
    reason: str = Field(min_length=1)


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminOverrideStatusRequest(BaseModel):
    status: str = Field(min_length=1)
    reason: str = Field(min_length=1)
