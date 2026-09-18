from __future__ import annotations

from pydantic import BaseModel, Field


class LocationUpdate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class AvailabilityUpdate(BaseModel):
    online: bool


class RiderResponse(BaseModel):
    id: str
    user_id: str
    name: str | None = None
    phone: str | None = None
    zone_id: str | None
    online: bool
    vehicle_type: str | None
    lat: float | None
    lng: float | None

    model_config = {"from_attributes": True}


class AssignRiderRequest(BaseModel):
    rider_id: str | None = None  # if None, auto-picks nearest online rider


class AssignRiderResponse(BaseModel):
    order_id: str
    rider_id: str
    message: str


class RiderEarningsSummaryResponse(BaseModel):
    total_earned_kobo: int
    pending_kobo: int
    deliveries_paid: int


class RiderPayoutResponse(BaseModel):
    id: str
    order_id: str
    amount_kobo: int
    status: str
    created_at: str

    model_config = {"from_attributes": True}


class PaginatedRiderPayoutsResponse(BaseModel):
    items: list[RiderPayoutResponse]
    total: int
    page: int
    page_size: int
