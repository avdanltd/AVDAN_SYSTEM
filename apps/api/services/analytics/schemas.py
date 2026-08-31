from __future__ import annotations

from pydantic import BaseModel


class OverviewResponse(BaseModel):
    active_orders: int
    riders_online: int
    revenue_today_kobo: int
    gmv_today_kobo: int
    orders_today: int
    pending_disputes: int


class OrderVolumePoint(BaseModel):
    period: str
    order_count: int
    volume_kobo: int


class OrderVolumeResponse(BaseModel):
    period_type: str
    data: list[OrderVolumePoint]


class VendorAnalyticsResponse(BaseModel):
    vendor_id: str
    total_orders: int
    active_orders: int
    completed_orders: int
    total_revenue_kobo: int
    pending_release_kobo: int
    commission_rate: float
    rejection_count: int
    rejection_rate_pct: float


class PlatformConfigResponse(BaseModel):
    config: dict


class UpdateConfigRequest(BaseModel):
    updates: dict
