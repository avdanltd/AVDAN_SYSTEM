"""Vendor service — business logic only, no HTTP concerns."""
from __future__ import annotations

import re
import secrets
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.exceptions import NotFoundException
from services.vendor.models import Product, Vendor
from services.vendor.schemas import (
    CreateProductRequest,
    UpdateProductRequest,
    UpdateVendorProfileRequest,
)


class VendorService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Public products ───────────────────────────────────────────────────────

    async def list_products(
        self,
        page: int,
        page_size: int,
        category_id: str | None = None,
        vendor_id: str | None = None,
        search: str | None = None,
        min_price_kobo: int | None = None,
        max_price_kobo: int | None = None,
        sort: str = "newest",
    ) -> tuple[list[Product], int]:
        from services.categories.models import Category

        q = (
            select(Product)
            .join(Vendor, Product.vendor_id == Vendor.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .where(Product.available.is_(True), Vendor.status == "active")
            .options(selectinload(Product.vendor), selectinload(Product.category))
        )
        cq = (
            select(func.count())
            .select_from(Product)
            .join(Vendor, Product.vendor_id == Vendor.id)
            .where(Product.available.is_(True), Vendor.status == "active")
        )

        if category_id:
            q = q.where(Product.category_id == uuid.UUID(category_id))
            cq = cq.where(Product.category_id == uuid.UUID(category_id))

        if vendor_id:
            q = q.where(Product.vendor_id == uuid.UUID(vendor_id))
            cq = cq.where(Product.vendor_id == uuid.UUID(vendor_id))

        if search:
            pattern = f"%{search}%"
            q = q.where(
                or_(Product.name.ilike(pattern), Product.description.ilike(pattern))
            )
            cq = cq.where(
                or_(Product.name.ilike(pattern), Product.description.ilike(pattern))
            )

        if min_price_kobo is not None:
            q = q.where(Product.price_kobo >= min_price_kobo)
            cq = cq.where(Product.price_kobo >= min_price_kobo)

        if max_price_kobo is not None:
            q = q.where(Product.price_kobo <= max_price_kobo)
            cq = cq.where(Product.price_kobo <= max_price_kobo)

        total = (await self.db.execute(cq)).scalar_one()

        if sort == "price_asc":
            q = q.order_by(Product.price_kobo.asc())
        elif sort == "price_desc":
            q = q.order_by(Product.price_kobo.desc())
        elif sort == "popular":
            q = q.order_by(Product.stock_qty.desc(), Product.created_at.desc())
        else:
            q = q.order_by(Product.created_at.desc())

        q = q.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def get_product_by_id(self, product_id: str) -> tuple[Product, list[Product]]:
        result = await self.db.execute(
            select(Product)
            .where(Product.id == uuid.UUID(product_id), Product.available.is_(True))
            .options(selectinload(Product.vendor), selectinload(Product.category))
        )
        product = result.scalar_one_or_none()
        if not product:
            raise NotFoundException("Product not found")

        # Related: up to 4 other products from the same vendor
        related_result = await self.db.execute(
            select(Product)
            .where(
                Product.vendor_id == product.vendor_id,
                Product.id != product.id,
                Product.available.is_(True),
            )
            .options(selectinload(Product.vendor), selectinload(Product.category))
            .limit(4)
        )
        related = list(related_result.scalars().all())
        return product, related

    # ── Public vendors ────────────────────────────────────────────────────────

    async def list_vendors(
        self,
        zone_id: str | None,
        page: int,
        page_size: int,
        search: str | None = None,
    ) -> tuple[list[Vendor], int]:
        query = select(Vendor).where(Vendor.status == "active")
        count_query = select(func.count()).select_from(Vendor).where(Vendor.status == "active")

        if zone_id:
            query = query.where(Vendor.zone_id == zone_id)
            count_query = count_query.where(Vendor.zone_id == zone_id)

        if search:
            pattern = f"%{search}%"
            query = query.where(Vendor.name.ilike(pattern))
            count_query = count_query.where(Vendor.name.ilike(pattern))

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        offset = (page - 1) * page_size
        query = query.order_by(Vendor.rating.desc(), Vendor.created_at.desc())
        query = query.offset(offset).limit(page_size)

        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def get_vendor_by_slug(self, slug: str) -> Vendor:
        result = await self.db.execute(
            select(Vendor)
            .where(Vendor.slug == slug, Vendor.status == "active")
            .options(selectinload(Vendor.products).selectinload(Product.category))
        )
        vendor = result.scalar_one_or_none()
        if not vendor:
            raise NotFoundException("Vendor not found")
        return vendor

    # ── Vendor-authenticated ──────────────────────────────────────────────────

    async def get_or_create_vendor_for_user(self, user_id: str) -> Vendor:
        """Returns the vendor row for a user, creating it lazily if absent."""
        user_uuid = uuid.UUID(user_id)
        result = await self.db.execute(
            select(Vendor)
            .where(Vendor.user_id == user_uuid)
            .options(selectinload(Vendor.products).selectinload(Product.category))
        )
        vendor = result.scalar_one_or_none()
        if vendor:
            return vendor

        # Lazy-create from vendor_profile data
        from services.auth.models import VendorProfile
        profile_result = await self.db.execute(
            select(VendorProfile).where(VendorProfile.user_id == user_uuid)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            raise NotFoundException("Vendor profile not found")

        slug = await self._unique_slug(profile.business_name)
        vendor = Vendor(
            user_id=user_uuid,
            name=profile.business_name,
            slug=slug,
            description=profile.description,
            status="pending",
        )
        self.db.add(vendor)
        await self.db.flush()
        # Re-fetch with products loaded so the relationship is initialised
        result = await self.db.execute(
            select(Vendor)
            .where(Vendor.id == vendor.id)
            .options(selectinload(Vendor.products).selectinload(Product.category))
        )
        return result.scalar_one()

    async def update_vendor_profile(
        self, user_id: str, data: UpdateVendorProfileRequest
    ) -> Vendor:
        vendor = await self._get_vendor_for_user(user_id)

        if data.name is not None:
            vendor.name = data.name
            vendor.slug = await self._unique_slug(data.name, exclude_id=str(vendor.id))

        if data.description is not None:
            vendor.description = data.description

        if data.logo_url is not None:
            vendor.logo_url = data.logo_url

        return vendor

    async def create_product(self, user_id: str, data: CreateProductRequest) -> Product:
        vendor = await self._get_vendor_for_user(user_id)
        category_id = uuid.UUID(data.category_id) if data.category_id else None
        product = Product(
            vendor_id=vendor.id,
            category_id=category_id,
            name=data.name,
            description=data.description,
            price_kobo=data.price_kobo,
            stock_qty=data.stock_qty,
            image_urls=data.image_urls,
        )
        self.db.add(product)
        await self.db.flush()
        # Enqueue embedding generation
        try:
            from workers.tasks.embeddings import generate_product_embedding
            generate_product_embedding.delay(str(product.id))
        except Exception:
            pass
        # Re-select with `category` loaded — a newly added instance has no relationship
        # populated, and the serializer touching it would trigger an async lazy load.
        return await self._load_product_with_category(product.id)

    async def update_product(
        self, user_id: str, product_id: str, data: UpdateProductRequest
    ) -> Product:
        product = await self._get_product_for_user(user_id, product_id)

        if data.name is not None:
            product.name = data.name
        if data.description is not None:
            product.description = data.description
        if data.price_kobo is not None:
            product.price_kobo = data.price_kobo
        if data.stock_qty is not None:
            product.stock_qty = data.stock_qty
        if data.image_urls is not None:
            product.image_urls = data.image_urls
        if data.category_id is not None:
            product.category_id = uuid.UUID(data.category_id)

        try:
            from workers.tasks.embeddings import generate_product_embedding
            generate_product_embedding.delay(str(product.id))
        except Exception:
            pass
        return product

    async def delete_product(self, user_id: str, product_id: str) -> None:
        product = await self._get_product_for_user(user_id, product_id)
        await self.db.delete(product)

    async def set_product_availability(
        self, user_id: str, product_id: str, available: bool
    ) -> Product:
        product = await self._get_product_for_user(user_id, product_id)
        product.available = available
        return product

    # ── Payout account ────────────────────────────────────────────────────────

    async def list_banks(self) -> list:
        from services.payment.providers.registry import get_provider
        provider = get_provider("paystack")
        return await provider.get_banks()

    async def verify_payout_account(
        self, account_number: str, bank_code: str
    ) -> object:
        from services.payment.providers.registry import get_provider
        provider = get_provider("paystack")
        return await provider.resolve_account(account_number, bank_code)

    async def save_payout_account(
        self,
        user_id: str,
        account_number: str,
        bank_code: str,
        bank_name: str,
        account_name: str,
    ) -> Vendor:
        from services.payment.providers.registry import get_provider
        vendor = await self._get_vendor_for_user(user_id)
        provider = get_provider("paystack")
        result = await provider.create_transfer_recipient(account_name, account_number, bank_code)
        vendor.paystack_recipient_code = result.recipient_code
        vendor.payout_account_number = account_number
        vendor.payout_bank_name = bank_name
        vendor.payout_account_name = account_name
        return vendor

    async def get_payout_account(self, user_id: str) -> Vendor:
        return await self._get_vendor_for_user(user_id)

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get_vendor_for_user(self, user_id: str) -> Vendor:
        result = await self.db.execute(
            select(Vendor).where(Vendor.user_id == uuid.UUID(user_id))
        )
        vendor = result.scalar_one_or_none()
        if not vendor:
            raise NotFoundException("Vendor not found")
        return vendor

    async def _load_product_with_category(self, product_id: uuid.UUID) -> Product:
        result = await self.db.execute(
            select(Product)
            .where(Product.id == product_id)
            .options(selectinload(Product.category))
        )
        return result.scalar_one()

    async def _get_product_for_user(self, user_id: str, product_id: str) -> Product:
        vendor = await self._get_vendor_for_user(user_id)
        result = await self.db.execute(
            # `category` MUST be eager-loaded: the router's _product_response reads
            # `product.category.name`, and under the async engine a lazy load there raises
            # "greenlet_spawn has not been called". Without this every vendor product write
            # (create / update / availability) returned a 500.
            select(Product)
            .where(
                Product.id == uuid.UUID(product_id),
                Product.vendor_id == vendor.id,
            )
            .options(selectinload(Product.category))
        )
        product = result.scalar_one_or_none()
        if not product:
            raise NotFoundException("Product not found")
        return product

    async def _unique_slug(self, name: str, exclude_id: str | None = None) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "vendor"
        slug = base
        query = select(Vendor).where(Vendor.slug == slug)
        if exclude_id:
            query = query.where(Vendor.id != uuid.UUID(exclude_id))
        if not (await self.db.execute(query)).scalar_one_or_none():
            return slug
        # Collision — append random suffix
        slug = f"{base}-{secrets.token_hex(3)}"
        return slug
