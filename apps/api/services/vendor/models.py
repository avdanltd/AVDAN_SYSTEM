import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import BaseModel

if TYPE_CHECKING:
    from services.auth.models import User
    from services.categories.models import Category

VendorStatus = str  # "pending" | "active" | "suspended" | "rejected"


class DeliveryZone(BaseModel):
    __tablename__ = "delivery_zones"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    vendors: Mapped[list["Vendor"]] = relationship("Vendor", back_populates="zone")


class Vendor(BaseModel):
    __tablename__ = "vendors"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("delivery_zones.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Free-text address plus geocoded coordinates — nullable because geocoding at registration
    # is best-effort. A vendor without coordinates falls back to zone-based rider/hub matching.
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    lat: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    lng: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    rating: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), default=Decimal("0.00"), nullable=False
    )
    paystack_recipient_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payout_account_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payout_bank_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    payout_account_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    user: Mapped["User"] = relationship("User")
    zone: Mapped["DeliveryZone | None"] = relationship("DeliveryZone", back_populates="vendors")
    products: Mapped[list["Product"]] = relationship(
        "Product", back_populates="vendor", cascade="all, delete-orphan"
    )


class Product(BaseModel):
    __tablename__ = "products"

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_kobo: Mapped[int] = mapped_column(Integer, nullable=False)
    available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_urls: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="products")
    category: Mapped["Category | None"] = relationship("Category", back_populates="products")

    @property
    def category_name(self) -> str | None:
        if TYPE_CHECKING:
            from services.categories.models import Category as _Category  # noqa: F401
        cat = self.__dict__.get("category")
        return cat.name if cat is not None else None
