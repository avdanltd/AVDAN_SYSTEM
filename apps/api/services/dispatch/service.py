"""Dispatch service — rider assignment, availability, GPS tracking."""
from __future__ import annotations

import json
import math
import uuid
from datetime import UTC, datetime

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AppError, NotFoundException
from services.dispatch.models import Rider, RiderLocation
from services.orders.models import Order
from services.orders.service import OrderService
from services.orders.state_machine import OrderStatus

# Redis TTL for live rider location (seconds)
_LOCATION_TTL = 60


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def calculate_eta_seconds(
    rider_lat: float, rider_lng: float, dest_lat: float, dest_lng: float
) -> int:
    distance_km = _haversine_km(rider_lat, rider_lng, dest_lat, dest_lng)
    return int((distance_km / 30.0) * 3600)  # 30 km/h average speed


class DispatchService:
    def __init__(self, db: AsyncSession, redis: aioredis.Redis) -> None:  # type: ignore[type-arg]
        self.db = db
        self.redis = redis

    # ── Rider-facing ──────────────────────────────────────────────────────────

    async def get_or_create_rider(self, user_id: str) -> Rider:
        result = await self.db.execute(
            select(Rider).where(Rider.user_id == uuid.UUID(user_id))
        )
        rider = result.scalar_one_or_none()
        if not rider:
            from services.auth.models import RiderProfile
            profile_result = await self.db.execute(
                select(RiderProfile).where(RiderProfile.user_id == uuid.UUID(user_id))
            )
            if not profile_result.scalar_one_or_none():
                raise NotFoundException("Rider profile not found")
            rider = Rider(user_id=uuid.UUID(user_id))
            self.db.add(rider)
            await self.db.flush()
        return rider

    async def set_availability(self, user_id: str, online: bool) -> Rider:
        rider = await self.get_or_create_rider(user_id)
        rider.online = online
        if not online:
            await self.redis.delete(f"rider:location:{rider.id}")
        return rider

    async def update_location(self, user_id: str, lat: float, lng: float) -> Rider:
        rider = await self.get_or_create_rider(user_id)

        # Write live state to Redis with TTL
        location_data = json.dumps(
            {"lat": lat, "lng": lng, "updated_at": datetime.now(UTC).isoformat()}
        )
        await self.redis.setex(f"rider:location:{rider.id}", _LOCATION_TTL, location_data)

        # Update rider's last known position
        rider.lat = lat  # type: ignore[assignment]
        rider.lng = lng  # type: ignore[assignment]

        # Write audit record to partitioned table
        self.db.add(
            RiderLocation(
                rider_id=rider.id,
                lat=lat,  # type: ignore[arg-type]
                lng=lng,  # type: ignore[arg-type]
            )
        )
        await self.db.flush()

        # Publish to any order channels this rider is active on
        await self._publish_rider_location(rider, lat, lng)

        return rider

    # ── Admin/Dispatch-facing ─────────────────────────────────────────────────

    async def assign_rider(self, order_id: str) -> Rider:
        order = await self._get_order(order_id)
        if order.status != OrderStatus.READY_FOR_PICKUP:
            raise AppError(400, "INVALID_STATE", "Order must be READY_FOR_PICKUP to assign a rider")

        # Find vendor's zone
        from services.vendor.models import Vendor
        vendor_result = await self.db.execute(
            select(Vendor).where(Vendor.id == order.vendor_id)
        )
        vendor = vendor_result.scalar_one_or_none()
        zone_id = vendor.zone_id if vendor else None

        # Find online riders in zone, not already on an active order
        query = select(Rider).where(Rider.online.is_(True))
        if zone_id:
            query = query.where(Rider.zone_id == zone_id)

        result = await self.db.execute(query)
        candidates = list(result.scalars().all())

        if not candidates:
            raise AppError(404, "NO_RIDERS_AVAILABLE", "No online riders available in this zone")

        # Prefer nearest rider if vendor has coordinates
        nearest = candidates[0]
        if vendor and vendor.lat and vendor.lng:
            def _dist(r: Rider) -> float:
                if r.lat and r.lng:
                    return _haversine_km(float(r.lat), float(r.lng), float(vendor.lat), float(vendor.lng))  # type: ignore[arg-type]
                return float("inf")
            nearest = min(candidates, key=_dist)

        # Assign rider to order via state machine
        order.rider_id = nearest.id
        order_svc = OrderService(self.db)
        await order_svc.transition(
            order_id=order_id,
            to_state=OrderStatus.PICKED_UP,
            actor_id=str(nearest.user_id),
            actor_role="rider",
            metadata={"assigned_rider_id": str(nearest.id)},
        )
        return nearest

    async def get_available_riders(self, zone_id: str | None) -> list[Rider]:
        query = select(Rider).where(Rider.online.is_(True))
        if zone_id:
            query = query.where(Rider.zone_id == uuid.UUID(zone_id))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    # ── Private ───────────────────────────────────────────────────────────────

    async def _get_order(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order).where(Order.id == uuid.UUID(order_id))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        return order

    async def _publish_rider_location(
        self, rider: Rider, lat: float, lng: float
    ) -> None:
        """Publish location to all orders this rider is currently serving."""
        result = await self.db.execute(
            select(Order).where(
                Order.rider_id == rider.id,
                Order.status.in_([
                    OrderStatus.PICKED_UP,
                    OrderStatus.IN_TRANSIT_TO_HUB,
                    OrderStatus.AT_HUB,
                    OrderStatus.OUT_FOR_DELIVERY,
                ]),
            )
        )
        active_orders = result.scalars().all()
        for order in active_orders:
            message = json.dumps({
                "type": "location_update",
                "rider_id": str(rider.id),
                "lat": lat,
                "lng": lng,
                "updated_at": datetime.now(UTC).isoformat(),
            })
            await self.redis.publish(f"order:{order.id}", message)
