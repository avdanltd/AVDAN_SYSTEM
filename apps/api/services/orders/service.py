"""Order service — the only place that writes orders.status."""
from __future__ import annotations

import math
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.exceptions import AppError, ForbiddenException, NotFoundException, ValidationException
from services.orders.models import Order, OrderEvent, OrderItem
from services.orders.schemas import CreateOrderRequest, RejectOrderRequest
from services.orders.state_machine import OrderStatus, validate_transition


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres. Duplicated from services/dispatch/service.py — that
    module imports OrderService, so importing the other way would be circular."""
    R = 6371.0  # noqa: N806 — standard symbol for Earth's radius
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


class OrderService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _calculate_delivery_fee(self, vendor: object, delivery_address: dict) -> int:
        """base_fee_kobo + per_km_kobo * distance(vendor, customer), from platform_config's
        delivery_fee_structure. Falls back to the flat base fee whenever either coordinate is
        missing — which, today, is every order: checkout's DeliveryAddress schema has no lat/lng
        field, so customer coordinates are never actually captured yet. This degrades gracefully
        now and picks up real distance-based pricing automatically once that's wired up."""
        from services.analytics.service import AnalyticsService

        config = await AnalyticsService(self.db).get_config()
        fee_structure = config.get("delivery_fee_structure", {})
        base_fee_kobo = int(fee_structure.get("base_fee_kobo", 0))
        per_km_kobo = int(fee_structure.get("per_km_kobo", 0))

        v_lat = getattr(vendor, "lat", None)
        v_lng = getattr(vendor, "lng", None)
        c_lat = delivery_address.get("lat")
        c_lng = delivery_address.get("lng")
        if v_lat is None or v_lng is None or c_lat is None or c_lng is None:
            return base_fee_kobo

        distance_km = _haversine_km(float(v_lat), float(v_lng), float(c_lat), float(c_lng))
        return base_fee_kobo + int(per_km_kobo * distance_km)

    # ── Customer ──────────────────────────────────────────────────────────────

    async def create_order(self, customer_id: str, data: CreateOrderRequest) -> Order:
        from services.vendor.models import Product, Vendor

        # Validate vendor is active
        vendor_result = await self.db.execute(
            select(Vendor).where(
                Vendor.id == uuid.UUID(data.vendor_id),
                Vendor.status == "active",
            )
        )
        vendor = vendor_result.scalar_one_or_none()
        if not vendor:
            raise NotFoundException("Vendor not found or not active")

        # Validate all products and snapshot prices
        product_ids = [uuid.UUID(item.product_id) for item in data.items]
        products_result = await self.db.execute(
            select(Product).where(
                Product.id.in_(product_ids),
                Product.vendor_id == vendor.id,
                Product.available.is_(True),
            )
        )
        products_by_id = {str(p.id): p for p in products_result.scalars().all()}

        for item in data.items:
            product = products_by_id.get(item.product_id)
            if not product:
                raise ValidationException(
                    f"Product {item.product_id} not found, unavailable, or not from this vendor"
                )
            if product.stock_qty < item.quantity:
                raise ValidationException(
                    f"Insufficient stock for '{product.name}' (requested {item.quantity}, available {product.stock_qty})"
                )

        # Build order items and compute total
        total_kobo = 0
        order_items: list[dict] = []
        for item in data.items:
            product = products_by_id[item.product_id]
            subtotal = product.price_kobo * item.quantity
            total_kobo += subtotal
            order_items.append(
                {
                    "product": product,
                    "product_id": product.id,
                    "product_name": product.name,
                    # Snapshot the primary image with the name and price, so a later catalogue
                    # edit cannot change what an existing order shows.
                    "product_image_url": (product.image_urls or [None])[0],
                    "price_kobo": product.price_kobo,
                    "quantity": item.quantity,
                    "subtotal_kobo": subtotal,
                }
            )

        delivery_address = data.delivery_address.model_dump()
        delivery_fee_kobo = await self._calculate_delivery_fee(vendor, delivery_address)

        # Create order
        order = Order(
            customer_id=uuid.UUID(customer_id),
            vendor_id=vendor.id,
            status=OrderStatus.PENDING,
            total_kobo=total_kobo,
            delivery_fee_kobo=delivery_fee_kobo,
            delivery_address=delivery_address,
        )
        self.db.add(order)
        await self.db.flush()

        # Create order items and decrement stock atomically
        for item_data in order_items:
            self.db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=item_data["product_id"],
                    product_name=item_data["product_name"],
                    product_image_url=item_data["product_image_url"],
                    price_kobo=item_data["price_kobo"],
                    quantity=item_data["quantity"],
                    subtotal_kobo=item_data["subtotal_kobo"],
                )
            )
            item_data["product"].stock_qty -= item_data["quantity"]

        # Record creation event
        self.db.add(
            OrderEvent(
                order_id=order.id,
                from_state=None,
                to_state=OrderStatus.PENDING,
                actor_id=uuid.UUID(customer_id),
                actor_role="customer",
            )
        )

        await self.db.flush()
        return await self._load_order_with_items(str(order.id))

    async def list_customer_orders(
        self, customer_id: str, page: int, page_size: int
    ) -> tuple[list[Order], int]:
        customer_uuid = uuid.UUID(customer_id)
        count_result = await self.db.execute(
            select(func.count()).select_from(Order).where(Order.customer_id == customer_uuid)
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            select(Order)
            .where(Order.customer_id == customer_uuid)
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_customer_order(self, customer_id: str, order_id: str) -> Order:
        order = await self._load_order_full(order_id)
        if str(order.customer_id) != customer_id:
            raise ForbiddenException("Access denied")
        return order

    async def cancel_order(self, customer_id: str, order_id: str) -> Order:
        from datetime import UTC, datetime

        from services.analytics.service import AnalyticsService

        order = await self._get_order(order_id)
        if str(order.customer_id) != customer_id:
            raise ForbiddenException("Access denied")
        if order.status != OrderStatus.PENDING:
            raise AppError(400, "INVALID_TRANSITION", "Only PENDING orders can be cancelled")

        # `order_cancellation_window_minutes` (admin-configurable, PlatformConfig) existed as a
        # config value with no enforcement anywhere until now. Scoped deliberately to PENDING-only
        # cancellation (no money has moved yet, so this is purely a "how long is an unpaid order
        # left cancellable before it's considered abandoned" policy) rather than extending
        # self-service cancellation to PAID+ orders, which would need to trigger a real refund —
        # a bigger product decision this session did not make unprompted.
        config = await AnalyticsService(self.db).get_config()
        window_minutes = config["order_cancellation_window_minutes"]
        age_minutes = (datetime.now(UTC) - order.created_at).total_seconds() / 60
        if age_minutes > window_minutes:
            raise AppError(
                400,
                "CANCELLATION_WINDOW_EXPIRED",
                f"This order can no longer be cancelled — the {window_minutes}-minute "
                "cancellation window has passed. Contact support if you need help.",
            )

        await self._apply_transition(order, OrderStatus.CANCELLED, customer_id, "customer")
        await self._restore_stock(order_id)
        return await self._load_order_with_items(order_id)

    # ── Vendor ────────────────────────────────────────────────────────────────

    async def list_vendor_orders(
        self, vendor_user_id: str, status: str | None, page: int, page_size: int
    ) -> tuple[list[Order], int]:
        vendor = await self._get_vendor_for_user(vendor_user_id)

        query = select(Order).where(Order.vendor_id == vendor.id)
        count_query = select(func.count()).select_from(Order).where(Order.vendor_id == vendor.id)

        if status:
            query = query.where(Order.status == status)
            count_query = count_query.where(Order.status == status)

        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            query
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_vendor_order(self, vendor_user_id: str, order_id: str) -> Order:
        order = await self._load_order_full(order_id)
        await self._assert_vendor_owns_order(vendor_user_id, order)
        return order

    async def accept_order(self, vendor_user_id: str, order_id: str) -> Order:
        """PAID → VENDOR_ACCEPTED → PREPARING (two events, one request)."""
        order = await self._get_order(order_id)
        await self._assert_vendor_owns_order(vendor_user_id, order)

        # Escrow release fails silently deep in a Celery retry loop if the vendor never set up
        # a payout account (see PaymentService.release_escrow's VENDOR_PAYOUT_NOT_CONFIGURED).
        # Catching it here, before the vendor can even commit to fulfilling, means that failure
        # mode can't happen — better than the money getting stuck after the customer already
        # paid and the order is already in flight.
        from services.vendor.models import Vendor
        vendor_result = await self.db.execute(
            select(Vendor).where(Vendor.id == order.vendor_id)
        )
        vendor = vendor_result.scalar_one_or_none()
        if not vendor or not vendor.paystack_recipient_code:
            raise AppError(
                422,
                "PAYOUT_ACCOUNT_REQUIRED",
                "Add a payout bank account in Settings before accepting orders.",
            )

        validate_transition(order.status, OrderStatus.VENDOR_ACCEPTED, "vendor")
        await self._record_event(order, OrderStatus.VENDOR_ACCEPTED, vendor_user_id, "vendor")
        order.status = OrderStatus.VENDOR_ACCEPTED

        validate_transition(order.status, OrderStatus.PREPARING, "vendor")
        await self._record_event(order, OrderStatus.PREPARING, vendor_user_id, "vendor")
        order.status = OrderStatus.PREPARING

        return await self._load_order_with_items(order_id)

    async def reject_order(
        self, vendor_user_id: str, order_id: str, data: RejectOrderRequest
    ) -> Order:
        order = await self._get_order(order_id)
        await self._assert_vendor_owns_order(vendor_user_id, order)

        validate_transition(order.status, OrderStatus.VENDOR_REJECTED, "vendor")
        await self._record_event(
            order,
            OrderStatus.VENDOR_REJECTED,
            vendor_user_id,
            "vendor",
            metadata={"reason": data.reason},
        )
        order.status = OrderStatus.VENDOR_REJECTED
        await self._restore_stock(order_id)
        order = await self._load_order_with_items(order_id)

        # Trigger automatic refund in background (non-blocking)
        try:
            import asyncio

            from workers.tasks.escrow import refund_rejected_order
            loop = asyncio.get_running_loop()
            loop.run_in_executor(
                None,
                lambda: refund_rejected_order.apply_async(
                    args=[order_id], countdown=5
                ),
            )
        except Exception:
            pass

        return order

    async def mark_ready(self, vendor_user_id: str, order_id: str) -> Order:
        order = await self._get_order(order_id)
        await self._assert_vendor_owns_order(vendor_user_id, order)

        validate_transition(order.status, OrderStatus.READY_FOR_PICKUP, "vendor")
        await self._apply_transition(order, OrderStatus.READY_FOR_PICKUP, vendor_user_id, "vendor")
        return await self._load_order_with_items(order_id)

    # ── Internal / system transitions (used by payment webhook in Phase 5) ───

    async def transition(
        self,
        order_id: str,
        to_state: str,
        actor_id: str | None,
        actor_role: str,
        metadata: dict | None = None,
    ) -> Order:
        order = await self._get_order(order_id)
        validate_transition(order.status, to_state, actor_role)
        await self._record_event(order, to_state, actor_id, actor_role, metadata=metadata)
        order.status = to_state
        return order

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get_order(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order).where(Order.id == uuid.UUID(order_id))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        return order

    async def _load_order_with_items(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order)
            .where(Order.id == uuid.UUID(order_id))
            .options(selectinload(Order.items))
        )
        return result.scalar_one()

    async def _load_order_full(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order)
            .where(Order.id == uuid.UUID(order_id))
            .options(selectinload(Order.items), selectinload(Order.events))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        return order

    async def _apply_transition(
        self,
        order: Order,
        to_state: str,
        actor_id: str | None,
        actor_role: str,
        metadata: dict | None = None,
    ) -> None:
        validate_transition(order.status, to_state, actor_role)
        await self._record_event(order, to_state, actor_id, actor_role, metadata=metadata)
        order.status = to_state

    async def _record_event(
        self,
        order: Order,
        to_state: str,
        actor_id: str | None,
        actor_role: str,
        metadata: dict | None = None,
    ) -> None:
        from_state = order.status
        self.db.add(
            OrderEvent(
                order_id=order.id,
                from_state=from_state,
                to_state=to_state,
                actor_id=uuid.UUID(actor_id) if actor_id else None,
                actor_role=actor_role,
                event_metadata=metadata,
            )
        )
        await self.db.flush()

        # Celery's apply_async makes a synchronous broker connection — run it in a
        # thread so it doesn't conflict with SQLAlchemy's async greenlet context.
        try:
            import asyncio

            from workers.tasks.notifications import send_order_notification
            loop = asyncio.get_running_loop()
            loop.run_in_executor(
                None,
                lambda: send_order_notification.apply_async(
                    args=[str(order.id), from_state, to_state],
                    countdown=2,
                ),
            )
        except Exception:
            pass  # notification failure must never break the order flow

        # Push the new status to anyone with the live tracking WS open for this order
        # (services/tracking/router.py). Best-effort — a customer who missed the push still
        # gets the current status on their next reconnect/page load.
        try:
            import json

            import redis.asyncio as aioredis

            from core.redis import redis_pool
            redis = aioredis.Redis(connection_pool=redis_pool)
            await redis.publish(
                f"order:{order.id}",
                json.dumps({"type": "status", "status": to_state}),
            )
        except Exception:
            pass

    async def _get_vendor_for_user(self, user_id: str) -> object:
        from services.vendor.models import Vendor
        result = await self.db.execute(
            select(Vendor).where(Vendor.user_id == uuid.UUID(user_id))
        )
        vendor = result.scalar_one_or_none()
        if not vendor:
            raise NotFoundException("Vendor profile not found")
        return vendor

    async def _assert_vendor_owns_order(self, vendor_user_id: str, order: Order) -> None:
        vendor = await self._get_vendor_for_user(vendor_user_id)
        from services.vendor.models import Vendor
        v: Vendor = vendor  # type: ignore[assignment]
        if order.vendor_id != v.id:
            raise ForbiddenException("Access denied")

    async def _restore_stock(self, order_id: str) -> None:
        """Returns stock to products when an order is cancelled or rejected."""
        from services.vendor.models import Product
        items_result = await self.db.execute(
            select(OrderItem).where(OrderItem.order_id == uuid.UUID(order_id))
        )
        items = items_result.scalars().all()
        for item in items:
            product_result = await self.db.execute(
                select(Product).where(Product.id == item.product_id)
            )
            product = product_result.scalar_one_or_none()
            if product:
                product.stock_qty += item.quantity
