"""Reviews and ratings: who may review what, and the averages shown on products and vendors.

A review comes from a customer's own order that has *ended* — delivered/completed, or refunded,
cancelled, rejected or dispute-resolved — and was paid. They rate each product and/or the vendor
once. Vendors cannot reply; admins can hide a review (it then drops out of every average)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AppError, NotFoundException
from services.orders.models import Order, OrderEvent
from services.orders.state_machine import OrderStatus
from services.review.models import Review, ReviewStatus, ReviewTarget
from services.review.schemas import SubmitReviewsRequest

# Ended in a way where the customer has had the experience: they got it, or it was refunded /
# cancelled / rejected / settled after a dispute. In-flight states (and FAILED_DELIVERY, which
# can still be retried) are not reviewable yet.
REVIEWABLE_STATUSES = frozenset({
    OrderStatus.DELIVERED,
    OrderStatus.PAYMENT_RELEASE_PENDING,
    OrderStatus.PAYMENT_RELEASED,
    OrderStatus.COMPLETED,
    OrderStatus.DISPUTE_RESOLVED,
    OrderStatus.REFUND_INITIATED,
    OrderStatus.VENDOR_REJECTED,
    OrderStatus.CANCELLED,
})


def reviewer_label(name: str | None) -> str:
    """`Ada Obi` -> `Ada O.` — public reviews never show a full name."""
    parts = (name or "").split()
    if not parts:
        return "Customer"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0].upper()}."


def _avg(values: list[int]) -> Decimal:
    if not values:
        return Decimal("0.00")
    return (Decimal(sum(values)) / Decimal(len(values))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ReviewService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Customer side ────────────────────────────────────────────────────────

    async def _own_order(self, order_id: str, customer_user_id: str) -> Order:
        try:
            oid = uuid.UUID(order_id)
        except ValueError as exc:
            raise NotFoundException("Order not found") from exc
        order = (await self.db.execute(
            select(Order).where(Order.id == oid, Order.customer_id == uuid.UUID(customer_user_id))
        )).scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        await self.db.refresh(order, ["items"])
        return order

    async def _ineligible_reason(self, order: Order) -> str | None:
        if order.status not in REVIEWABLE_STATUSES:
            return "You can review an order once it has been delivered or has ended."
        was_paid = (await self.db.execute(
            select(func.count()).select_from(OrderEvent).where(
                OrderEvent.order_id == order.id, OrderEvent.to_state == OrderStatus.PAID
            )
        )).scalar_one()
        if not was_paid:
            return "This order was never paid, so it can't be reviewed."
        return None

    async def get_order_reviews(self, order_id: str, customer_user_id: str) -> dict:
        from services.auth.models import User
        from services.vendor.models import Vendor

        order = await self._own_order(order_id, customer_user_id)
        reason = await self._ineligible_reason(order)
        reviews = list((await self.db.execute(
            select(Review).where(Review.order_id == order.id)
        )).scalars().all())
        customer = await self.db.get(User, order.customer_id)
        label = reviewer_label(customer.name if customer else None)
        vendor = await self.db.get(Vendor, order.vendor_id)
        names = {i.product_id: i.product_name for i in order.items}

        by_product = {r.product_id: r for r in reviews if r.target_type == ReviewTarget.PRODUCT}
        vendor_review = next((r for r in reviews if r.target_type == ReviewTarget.VENDOR), None)
        seen: set[uuid.UUID] = set()
        products = []
        for item in order.items:
            if item.product_id in seen:
                continue
            seen.add(item.product_id)
            r = by_product.get(item.product_id)
            products.append({
                "product_id": str(item.product_id),
                "product_name": item.product_name,
                "image_url": item.product_image_url,
                "review": self.to_response(r, label, names.get(r.product_id) if r else None) if r else None,
            })
        return {
            "eligible": reason is None,
            "reason": reason,
            "vendor_name": vendor.name if vendor else None,
            "vendor": self.to_response(vendor_review, label) if vendor_review else None,
            "products": products,
        }

    async def submit(self, order_id: str, customer_user_id: str, data: SubmitReviewsRequest) -> dict:
        if data.vendor is None and not data.products:
            raise AppError(422, "NOTHING_TO_REVIEW", "Rate the vendor or at least one product.")
        order = await self._own_order(order_id, customer_user_id)
        reason = await self._ineligible_reason(order)
        if reason:
            raise AppError(409, "ORDER_NOT_REVIEWABLE", reason)

        in_order = {i.product_id for i in order.items}
        wanted: list[tuple[uuid.UUID | None, str, int, str | None]] = []
        for p in data.products:
            try:
                pid = uuid.UUID(p.product_id)
            except ValueError as exc:
                raise AppError(422, "PRODUCT_NOT_IN_ORDER", "That product is not part of this order.") from exc
            if pid not in in_order:
                raise AppError(422, "PRODUCT_NOT_IN_ORDER", "That product is not part of this order.")
            wanted.append((pid, ReviewTarget.PRODUCT, p.rating, p.comment))
        if data.vendor is not None:
            wanted.append((None, ReviewTarget.VENDOR, data.vendor.rating, data.vendor.comment))
        if len({(pid, t) for pid, t, _, _ in wanted}) != len(wanted):
            raise AppError(422, "DUPLICATE_REVIEW", "Each product can be rated once.")

        existing = {(r.product_id, r.target_type) for r in (await self.db.execute(
            select(Review).where(Review.order_id == order.id)
        )).scalars().all()}
        if any((pid, t) in existing for pid, t, _, _ in wanted):
            raise AppError(409, "ALREADY_REVIEWED", "You have already reviewed that on this order.")

        for pid, target, rating, comment in wanted:
            self.db.add(Review(
                customer_id=order.customer_id, order_id=order.id, vendor_id=order.vendor_id,
                product_id=pid, target_type=target, rating=rating, comment=comment,
                order_outcome=order.status,
            ))
        await self.db.flush()
        for pid, target, _, _ in wanted:
            if target == ReviewTarget.PRODUCT and pid is not None:
                await self._recompute_product(pid)
            else:
                await self._recompute_vendor(order.vendor_id)
        return await self.get_order_reviews(order_id, customer_user_id)

    # ── Aggregates ───────────────────────────────────────────────────────────

    async def _visible_ratings(self, *conditions) -> list[int]:  # type: ignore[no-untyped-def]
        rows = await self.db.execute(
            select(Review.rating).where(Review.status == ReviewStatus.VISIBLE, *conditions)
        )
        return [r for (r,) in rows.all()]

    async def _recompute_product(self, product_id: uuid.UUID) -> None:
        from services.vendor.models import Product

        ratings = await self._visible_ratings(
            Review.product_id == product_id, Review.target_type == ReviewTarget.PRODUCT
        )
        product = await self.db.get(Product, product_id)
        if product:
            product.rating, product.review_count = _avg(ratings), len(ratings)

    async def _recompute_vendor(self, vendor_id: uuid.UUID) -> None:
        from services.vendor.models import Vendor

        ratings = await self._visible_ratings(
            Review.vendor_id == vendor_id, Review.target_type == ReviewTarget.VENDOR
        )
        vendor = await self.db.get(Vendor, vendor_id)
        if vendor:
            vendor.rating, vendor.review_count = _avg(ratings), len(ratings)

    # ── Public lists ─────────────────────────────────────────────────────────

    @staticmethod
    def to_response(r: Review, reviewer: str, product_name: str | None = None) -> dict:
        return {
            "id": str(r.id), "target_type": r.target_type,
            "product_id": str(r.product_id) if r.product_id else None, "product_name": product_name,
            "rating": r.rating, "comment": r.comment, "reviewer_name": reviewer,
            "verified_purchase": True, "created_at": r.created_at.isoformat(),
        }

    async def _public_page(self, conditions: list, page: int, page_size: int) -> dict:  # type: ignore[type-arg]
        from services.auth.models import User

        base = [Review.status == ReviewStatus.VISIBLE, *conditions]
        counts = {rating: n for rating, n in (await self.db.execute(
            select(Review.rating, func.count()).where(*base).group_by(Review.rating)
        )).all()}
        total = sum(counts.values())
        average = _avg([r for r, n in counts.items() for _ in range(n)])
        rows = (await self.db.execute(
            select(Review, User.name).join(User, User.id == Review.customer_id).where(*base)
            .order_by(Review.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )).all()
        return {
            "items": [self.to_response(r, reviewer_label(name)) for r, name in rows],
            "total": total, "page": page, "page_size": page_size,
            "summary": {
                "average": float(average), "count": total,
                "distribution": {str(i): counts.get(i, 0) for i in range(1, 6)},
            },
        }

    async def list_product_reviews(self, product_id: str, page: int, page_size: int) -> dict:
        try:
            pid = uuid.UUID(product_id)
        except ValueError as exc:
            raise NotFoundException("Product not found") from exc
        return await self._public_page(
            [Review.product_id == pid, Review.target_type == ReviewTarget.PRODUCT], page, page_size
        )

    async def list_vendor_reviews(self, vendor_id: str, page: int, page_size: int) -> dict:
        try:
            vid = uuid.UUID(vendor_id)
        except ValueError as exc:
            raise NotFoundException("Vendor not found") from exc
        return await self._public_page(
            [Review.vendor_id == vid, Review.target_type == ReviewTarget.VENDOR], page, page_size
        )

    # ── Admin moderation ─────────────────────────────────────────────────────

    async def admin_list(
        self, status: str | None, target_type: str | None, max_rating: int | None, page: int, page_size: int
    ) -> dict:
        conds = []
        if status:
            conds.append(Review.status == status)
        if target_type:
            conds.append(Review.target_type == target_type)
        if max_rating:
            conds.append(Review.rating <= max_rating)
        total = (await self.db.execute(select(func.count()).select_from(Review).where(*conds))).scalar_one()
        rows = (await self.db.execute(
            select(Review).where(*conds).order_by(Review.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size)
        )).scalars().all()

        return {
            "items": await self._admin_rows(list(rows)),
            "total": total, "page": page, "page_size": page_size,
        }

    async def admin_one(self, review: Review) -> dict:
        return (await self._admin_rows([review]))[0]

    async def _admin_rows(self, rows: list[Review]) -> list[dict]:
        from services.auth.models import User
        from services.vendor.models import Product, Vendor

        if not rows:
            return []
        user_ids = {r.customer_id for r in rows} | {r.hidden_by for r in rows if r.hidden_by}
        users = {uid: name or email for uid, name, email in (await self.db.execute(
            select(User.id, User.name, User.email).where(User.id.in_(user_ids))
        )).all()}
        vendors = {vid: n for vid, n in (await self.db.execute(
            select(Vendor.id, Vendor.name).where(Vendor.id.in_({r.vendor_id for r in rows}))
        )).all()}
        pids = {r.product_id for r in rows if r.product_id}
        products = {pid: n for pid, n in (await self.db.execute(
            select(Product.id, Product.name).where(Product.id.in_(pids))
        )).all()} if pids else {}
        return [{
            "id": str(r.id), "target_type": r.target_type, "rating": r.rating, "comment": r.comment,
            "status": r.status, "order_id": str(r.order_id), "order_outcome": r.order_outcome,
            "customer_name": users.get(r.customer_id), "vendor_name": vendors.get(r.vendor_id),
            "product_name": products.get(r.product_id) if r.product_id else None,
            "hidden_reason": r.hidden_reason,
            "hidden_by_name": users.get(r.hidden_by) if r.hidden_by else None,
            "created_at": r.created_at.isoformat(),
        } for r in rows]

    async def _moderate(self, review_id: str, admin_id: str, hide: bool, reason: str | None) -> Review:
        from services.analytics.models import AuditLog

        try:
            rid = uuid.UUID(review_id)
        except ValueError as exc:
            raise NotFoundException("Review not found") from exc
        review = (await self.db.execute(select(Review).where(Review.id == rid).with_for_update())).scalar_one_or_none()
        if not review:
            raise NotFoundException("Review not found")
        before = {"status": review.status}
        if hide:
            review.status, review.hidden_by, review.hidden_at, review.hidden_reason = (
                ReviewStatus.HIDDEN, uuid.UUID(admin_id), datetime.now(UTC), reason,
            )
        else:
            review.status, review.hidden_by, review.hidden_at, review.hidden_reason = (
                ReviewStatus.VISIBLE, None, None, None,
            )
        self.db.add(AuditLog(
            actor_id=uuid.UUID(admin_id), action="review.hide" if hide else "review.unhide",
            target_type="review", target_id=str(review.id), before=before,
            after={"status": review.status, "reason": reason},
        ))
        await self.db.flush()
        if review.target_type == ReviewTarget.PRODUCT and review.product_id:
            await self._recompute_product(review.product_id)
        else:
            await self._recompute_vendor(review.vendor_id)
        return review

    async def hide(self, review_id: str, admin_id: str, reason: str) -> Review:
        return await self._moderate(review_id, admin_id, True, reason)

    async def unhide(self, review_id: str, admin_id: str) -> Review:
        return await self._moderate(review_id, admin_id, False, None)
