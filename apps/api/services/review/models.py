import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import BaseModel


class ReviewTarget:
    PRODUCT = "product"
    VENDOR = "vendor"


class ReviewStatus:
    VISIBLE = "visible"
    HIDDEN = "hidden"  # taken down by an admin; excluded from averages and public lists


class Review(BaseModel):
    """A customer's rating of one product, or of the vendor, from one ended order.

    One review per order item and one vendor review per order (partial unique indexes), so a
    review can only come from someone who actually bought from that vendor. Reviews are never
    deleted — an admin hides them — and vendors cannot reply."""

    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
        Index(
            "uq_reviews_order_product", "order_id", "product_id",
            unique=True, postgresql_where=text("target_type = 'product'"),
        ),
        Index(
            "uq_reviews_order_vendor", "order_id",
            unique=True, postgresql_where=text("target_type = 'vendor'"),
        ),
        Index("ix_reviews_product", "product_id", "status"),
        Index("ix_reviews_vendor", "vendor_id", "status"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=True
    )
    target_type: Mapped[str] = mapped_column(String(10), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The order's status when it was reviewed (e.g. COMPLETED vs REFUND_INITIATED), so moderators
    # can tell a review of a delivered order from one of a cancelled order.
    order_outcome: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(10), default=ReviewStatus.VISIBLE, nullable=False)
    hidden_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    hidden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hidden_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
