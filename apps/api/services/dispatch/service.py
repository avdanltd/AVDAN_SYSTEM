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
    R = 6371.0  # noqa: N806 — standard symbol for Earth's radius
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

    async def assign_rider(self, order_id: str, rider_id: str | None = None) -> Rider:
        order = await self._get_order(order_id)
        if order.status != OrderStatus.READY_FOR_PICKUP:
            raise AppError(400, "INVALID_STATE", "Order must be READY_FOR_PICKUP to assign a rider")

        if rider_id:
            # Admin specified a rider explicitly — no online check required
            result = await self.db.execute(select(Rider).where(Rider.id == uuid.UUID(rider_id)))
            nearest = result.scalar_one_or_none()
            if not nearest:
                raise NotFoundException("Rider not found")
        else:
            # Find vendor's zone
            from services.vendor.models import Vendor
            vendor_result = await self.db.execute(
                select(Vendor).where(Vendor.id == order.vendor_id)
            )
            vendor = vendor_result.scalar_one_or_none()
            zone_id = vendor.zone_id if vendor else None

            # Find online riders in zone
            query = select(Rider).where(Rider.online.is_(True))
            if zone_id:
                query = query.where(Rider.zone_id == zone_id)

            result = await self.db.execute(query)
            candidates = list(result.scalars().all())

            if not candidates:
                raise AppError(404, "NO_RIDERS_AVAILABLE", "No online riders available in this zone")

            # Vendor has no lat/lng column (zone_id only) — no coordinates to refine
            # by distance against, so the nearest available rider in-zone is first-match.
            nearest = candidates[0]

        # Assign the rider and STOP. Assignment is not a state transition: the order stays
        # READY_FOR_PICKUP until the rider physically collects it and taps Confirm Pickup
        # (READY_FOR_PICKUP → PICKED_UP, actor_role="rider" — see state_machine.py:54).
        # Previously this auto-transitioned to PICKED_UP on behalf of the rider, which
        # fabricated a pickup that had not happened and made the rider's own Confirm Pickup
        # action unreachable. get_db() commits, so the rider_id write persists on its own.
        order.rider_id = nearest.id
        await self.db.flush()
        return nearest

    async def get_rider_orders(self, user_id: str) -> list[Order]:
        from sqlalchemy.orm import selectinload
        rider = await self.get_or_create_rider(user_id)
        result = await self.db.execute(
            select(Order)
            .where(
                Order.rider_id == rider.id,
                Order.status.in_([
                    # READY_FOR_PICKUP and QA_PASSED must be included: they are the two states
                    # where the rider is the actor for the next transition (READY_FOR_PICKUP →
                    # PICKED_UP, QA_PASSED → OUT_FOR_DELIVERY). Omitting them made an assigned
                    # order invisible to the rider who alone could advance it — a deadlock.
                    OrderStatus.READY_FOR_PICKUP,
                    OrderStatus.PICKED_UP,
                    OrderStatus.IN_TRANSIT_TO_HUB,
                    OrderStatus.AT_HUB,
                    OrderStatus.QA_PASSED,
                    OrderStatus.OUT_FOR_DELIVERY,
                ]),
            )
            .options(selectinload(Order.items))
        )
        return list(result.scalars().all())

    async def get_rider_order_history(
        self, user_id: str, limit: int = 50, offset: int = 0
    ) -> list[Order]:
        """Terminal-state orders this rider handled. Separate from the active list so a
        completed delivery leaves the working queue without vanishing from the app entirely."""
        from sqlalchemy.orm import selectinload
        rider = await self.get_or_create_rider(user_id)
        result = await self.db.execute(
            select(Order)
            .where(
                Order.rider_id == rider.id,
                Order.status.in_([
                    OrderStatus.DELIVERED,
                    OrderStatus.FAILED_DELIVERY,
                    OrderStatus.PAYMENT_RELEASE_PENDING,
                    OrderStatus.PAYMENT_RELEASED,
                    OrderStatus.COMPLETED,
                    OrderStatus.DISPUTED,
                    OrderStatus.DISPUTE_RESOLVED,
                    OrderStatus.CANCELLED,
                ]),
            )
            .options(selectinload(Order.items))
            .order_by(Order.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_rider_order(self, user_id: str, order_id: str) -> Order:
        """A single order scoped to this rider, in ANY status. The app's order-detail screen
        used to filter the active list client-side, so a just-delivered order rendered
        'Order not found' the instant it left that list."""
        from sqlalchemy.orm import selectinload
        rider = await self.get_or_create_rider(user_id)
        result = await self.db.execute(
            select(Order)
            .where(Order.id == uuid.UUID(order_id), Order.rider_id == rider.id)
            .options(selectinload(Order.items))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found or not assigned to this rider")
        return order

    async def rider_transition(self, user_id: str, order_id: str, to_state: str) -> Order:
        rider = await self.get_or_create_rider(user_id)
        result = await self.db.execute(
            select(Order).where(
                Order.id == uuid.UUID(order_id),
                Order.rider_id == rider.id,
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found or not assigned to this rider")
        order_svc = OrderService(self.db)
        order = await order_svc.transition(
            order_id=order_id,
            to_state=to_state,
            actor_id=user_id,
            actor_role="rider",
            metadata={},
        )

        # Delivery starts the escrow hold. Nothing else in the codebase moved an order out of
        # DELIVERED, so every delivered order used to sit there forever and the vendor was never
        # paid — `workers/tasks/escrow.py` only ever polled for orders ALREADY in
        # PAYMENT_RELEASE_PENDING. Chaining here (same pattern the hub QA flow uses for
        # QA_PASSED -> OUT_FOR_DELIVERY) closes the lifecycle: entering the state stamps
        # `updated_at`, which is the timestamp the 48h release cutoff is measured from.
        if to_state == OrderStatus.DELIVERED:
            order = await order_svc.transition(
                order_id=order_id,
                to_state=OrderStatus.PAYMENT_RELEASE_PENDING,
                actor_id=None,
                actor_role="system",
                metadata={"trigger": "rider_delivered", "rider_id": str(rider.id)},
            )

        return order

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
                    # READY_FOR_PICKUP and QA_PASSED must be included: they are the two states
                    # where the rider is the actor for the next transition (READY_FOR_PICKUP →
                    # PICKED_UP, QA_PASSED → OUT_FOR_DELIVERY). Omitting them made an assigned
                    # order invisible to the rider who alone could advance it — a deadlock.
                    OrderStatus.READY_FOR_PICKUP,
                    OrderStatus.PICKED_UP,
                    OrderStatus.IN_TRANSIT_TO_HUB,
                    OrderStatus.AT_HUB,
                    OrderStatus.QA_PASSED,
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
