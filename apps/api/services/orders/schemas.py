from __future__ import annotations

from pydantic import BaseModel, Field

# ── Shared sub-objects ────────────────────────────────────────────────────────

class DeliveryAddress(BaseModel):
    street: str = Field(min_length=1)
    city: str = Field(min_length=1)
    state: str = Field(min_length=1)
    country: str = "Nigeria"
    notes: str | None = None
    # Who the rider should call on arrival. Falls back to the customer's account phone.
    phone: str | None = Field(default=None, max_length=20)
    # Where the customer actually is. Drives the delivery fee (distance = fuel). Optional here so
    # older clients keep working, in which case the fee falls back to the flat base fee.
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


# ── Order items ───────────────────────────────────────────────────────────────

class OrderItemRequest(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


class OrderItemResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    product_image_url: str | None = None
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
    vendor_name: str | None = None
    rider_id: str | None = None
    # Filled in by the admin endpoints so staff can see who is fulfilling an order.
    rider_name: str | None = None
    rider_phone: str | None = None
    hub_id: str | None = None
    hub_name: str | None = None
    hub_lat: float | None = None
    hub_lng: float | None = None
    status: str
    total_kobo: int
    delivery_fee_kobo: int
    delivery_quote: dict | None = None
    delivery_address: dict
    # Only populated for the customer, and only while the order is out for delivery.
    delivery_code: str | None = None
    items: list[OrderItemResponse] = []
    created_at: str
    updated_at: str

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


class DeliveryQuoteResponse(BaseModel):
    fee_kobo: int
    method: str  # "via_hub" | "direct" | "flat"
    vendor_to_hub_km: float | None
    hub_to_customer_km: float | None
    total_km: float | None
    base_fee_kobo: int
    per_km_kobo: int
    road_factor: float
    hub_name: str | None = None
    # Smallest order subtotal (kobo) the platform accepts; 0 = no minimum.
    min_order_kobo: int = 0
