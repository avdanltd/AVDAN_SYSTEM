"""Order service — the only place that writes orders.status."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AppError, ForbiddenException, NotFoundException, ValidationException
from services.orders.models import Order, OrderEvent, OrderItem
from services.orders.schemas import CreateOrderRequest, RejectOrderRequest
from services.orders.state_machine import OrderStatus, validate_transition


class OrderService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

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
                    "price_kobo": product.price_kobo,
                    "quantity": item.quantity,
                    "subtotal_kobo": subtotal,
                }
            )

        # Create order
        order = Order(
            customer_id=uuid.UUID(customer_id),
            vendor_id=vendor.id,
            status=OrderStatus.PENDING,
            total_kobo=total_kobo,
            delivery_address=data.delivery_address.model_dump(),
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
        order = await self._get_order(order_id)
        if str(order.customer_id) != customer_id:
            raise ForbiddenException("Access denied")
        if order.status != OrderStatus.PENDING:
            raise AppError(400, "INVALID_TRANSITION", "Only PENDING orders can be cancelled")

        await self._apply_transition(order, OrderStatus.CANCELLED, customer_id, "customer")
        await self._restore_stock(order_id)
        return await self._load_order_with_items(order_id)

    # ── Vendor ────────────────────────────────────────────────────────────────

    async def list_vendor_orders(
        self, vendor_user_id: str, status: str | None, page: int, page_size: int
    ) -> tuple[list[Order], int]:
        from services.vendor.models import Vendor
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
