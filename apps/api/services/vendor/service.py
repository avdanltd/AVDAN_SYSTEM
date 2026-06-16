"""Vendor service — business logic only, no HTTP concerns."""
from __future__ import annotations

import re
import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ForbiddenException, NotFoundException, ConflictException
from services.vendor.models import DeliveryZone, Product, Vendor
from services.vendor.schemas import (
    CreateProductRequest,
    UpdateProductRequest,
    UpdateVendorProfileRequest,
)


class VendorService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Public ────────────────────────────────────────────────────────────────

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
            .options(selectinload(Vendor.products))
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
            .options(selectinload(Vendor.products))
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
            .options(selectinload(Vendor.products))
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
        product = Product(
            vendor_id=vendor.id,
            name=data.name,
            description=data.description,
            price_kobo=data.price_kobo,
            stock_qty=data.stock_qty,
            image_urls=data.image_urls,
        )
        self.db.add(product)
        await self.db.flush()
        return product

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

    async def _get_product_for_user(self, user_id: str, product_id: str) -> Product:
        vendor = await self._get_vendor_for_user(user_id)
        result = await self.db.execute(
            select(Product).where(
                Product.id == uuid.UUID(product_id),
                Product.vendor_id == vendor.id,
            )
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
