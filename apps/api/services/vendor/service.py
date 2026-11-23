"""Vendor service — business logic only, no HTTP concerns."""
from __future__ import annotations

import re
import secrets
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.exceptions import NotFoundException, ValidationException
from services.vendor.models import Business, Product, Vendor
from services.vendor.schemas import (
    CreateProductRequest,
    UpdateProductRequest,
    UpdateVendorProfileRequest,
)


class VendorService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Public products ───────────────────────────────────────────────────────

    @staticmethod
    def _location_where(state: str | None, lga: str | None) -> list:
        """Case-insensitive state / LGA match on the vendor's address."""
        out = []
        if state:
            out.append(func.lower(Vendor.state) == state.strip().lower())
        if lga:
            out.append(func.lower(Vendor.lga) == lga.strip().lower())
        return out

    @staticmethod
    def _distance_expr(lat: float, lng: float):
        """Squared planar distance to the vendor, in degrees — only used to ORDER vendors by
        nearness (exact km for display is computed in Python). Vendors with no coordinates sort last."""
        import math

        dlat = Vendor.lat - lat
        dlng = (Vendor.lng - lng) * math.cos(math.radians(lat))
        return dlat * dlat + dlng * dlng

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
        state: str | None = None,
        lga: str | None = None,
        near_lat: float | None = None,
        near_lng: float | None = None,
        business_slug: str | None = None,
    ) -> tuple[list[Product], int]:
        from services.categories.models import Category

        q = (
            select(Product)
            .join(Vendor, Product.vendor_id == Vendor.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .where(Product.available.is_(True), Product.approval_status == "APPROVED", Vendor.status == "active")
            .options(selectinload(Product.vendor), selectinload(Product.category))
        )
        cq = (
            select(func.count())
            .select_from(Product)
            .join(Vendor, Product.vendor_id == Vendor.id)
            .where(Product.available.is_(True), Product.approval_status == "APPROVED", Vendor.status == "active")
        )

        if category_id:
            # A top-level category also matches products filed under its sub-categories.
            cid = uuid.UUID(category_id)
            in_category = Product.category_id.in_(
                select(Category.id).where(or_(Category.id == cid, Category.parent_id == cid))
            )
            q = q.where(in_category)
            cq = cq.where(in_category)

        if vendor_id:
            q = q.where(Product.vendor_id == uuid.UUID(vendor_id))
            cq = cq.where(Product.vendor_id == uuid.UUID(vendor_id))

        if business_slug:
            # Every product of every branch of one business (each branch still sells its own).
            in_business = Product.vendor_id.in_(
                select(Vendor.id).join(Business, Business.id == Vendor.business_id).where(Business.slug == business_slug)
            )
            q = q.where(in_business)
            cq = cq.where(in_business)

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

        for cond in self._location_where(state, lga):
            q = q.where(cond)
            cq = cq.where(cond)

        total = (await self.db.execute(cq)).scalar_one()

        if sort == "nearest" and near_lat is not None and near_lng is not None:
            q = q.order_by(self._distance_expr(near_lat, near_lng).asc().nulls_last(), Product.created_at.desc())
        elif sort == "price_asc":
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
            .where(
                Product.id == uuid.UUID(product_id),
                Product.available.is_(True),
                Product.approval_status == "APPROVED",
            )
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
                Product.approval_status == "APPROVED",
            )
            .options(selectinload(Product.vendor), selectinload(Product.category))
            .limit(4)
        )
        related = list(related_result.scalars().all())
        return product, related

    async def attention_counts(self, user_id: str) -> dict:
        """What is waiting on this vendor: paid orders to accept or reject, products the admin
        rejected (which they need to fix), and unread messages from AVDAN. Drives the menu badges."""
        from services.orders.models import Order
        from services.orders.state_machine import OrderStatus

        vendor = await self.get_or_create_vendor_for_user(user_id)
        orders = (await self.db.execute(
            select(func.count()).select_from(Order)
            .where(Order.vendor_id == vendor.id, Order.status == OrderStatus.PAID)
        )).scalar_one()
        products = (await self.db.execute(
            select(func.count()).select_from(Product)
            .where(Product.vendor_id == vendor.id, Product.approval_status == "REJECTED")
        )).scalar_one()
        from services.vendor.messages import unread_count

        messages = await unread_count(self.db, vendor.id, "vendor")
        return {"orders": int(orders), "products": int(products), "messages": int(messages)}

    # ── Public vendors ────────────────────────────────────────────────────────

    async def list_vendors(
        self,
        zone_id: str | None,
        page: int,
        page_size: int,
        search: str | None = None,
        state: str | None = None,
        lga: str | None = None,
        near_lat: float | None = None,
        near_lng: float | None = None,
        group: bool = False,
    ) -> tuple[list[Vendor], int]:
        """`group=True` shows each business once (its nearest or best-rated matching branch stands
        for it) so the marketplace lists a brand, not one card per branch."""
        conds = [Vendor.status == "active"]
        if zone_id:
            conds.append(Vendor.zone_id == zone_id)
        if search:
            pattern = f"%{search}%"
            # A search for a brand finds all its branches, whatever each branch is called.
            conds.append(or_(
                Vendor.name.ilike(pattern),
                Vendor.business_id.in_(select(Business.id).where(Business.name.ilike(pattern))),
            ))
        conds.extend(self._location_where(state, lga))

        if near_lat is not None and near_lng is not None:
            order = [self._distance_expr(near_lat, near_lng).asc().nulls_last(), Vendor.rating.desc()]
        else:
            order = [Vendor.rating.desc(), Vendor.created_at.desc()]
        offset = (page - 1) * page_size

        if group:
            rank = func.row_number().over(
                partition_by=func.coalesce(Vendor.business_id, Vendor.id), order_by=order
            ).label("rn")
            ranked = select(Vendor.id.label("id"), rank).where(*conds).subquery()
            total = (await self.db.execute(
                select(func.count()).select_from(ranked).where(ranked.c.rn == 1)
            )).scalar_one()
            result = await self.db.execute(
                select(Vendor).join(ranked, ranked.c.id == Vendor.id).where(ranked.c.rn == 1)
                .order_by(*order).offset(offset).limit(page_size)
            )
            return list(result.scalars().all()), total

        total = (await self.db.execute(select(func.count()).select_from(Vendor).where(*conds))).scalar_one()
        result = await self.db.execute(select(Vendor).where(*conds).order_by(*order).offset(offset).limit(page_size))
        return list(result.scalars().all()), total

    async def business_info(self, vendors: list[Vendor]) -> dict:
        """{business_id: {slug, name, count, places}} for the businesses these vendors belong to:
        how many active branches each has and where, for the "3 branches" label on a card."""
        ids = {v.business_id for v in vendors if v.business_id}
        if not ids:
            return {}
        names = {b.id: b for b in (await self.db.execute(select(Business).where(Business.id.in_(ids)))).scalars().all()}
        rows = (await self.db.execute(
            select(Vendor.business_id, Vendor.city, Vendor.state).where(Vendor.business_id.in_(ids), Vendor.status == "active")
        )).all()
        info: dict = {}
        for bid, city, state in rows:
            d = info.setdefault(bid, {"count": 0, "places": []})
            d["count"] += 1
            place = ", ".join(x for x in (city, state) if x and x.strip())
            if place and place not in d["places"]:
                d["places"].append(place)
        return {
            bid: {"slug": names[bid].slug, "name": names[bid].name, "count": d["count"], "places": d["places"][:4]}
            for bid, d in info.items() if bid in names
        }

    async def get_business_by_slug(self, slug: str) -> tuple[Business, list[Vendor]]:
        biz = (await self.db.execute(select(Business).where(Business.slug == slug))).scalar_one_or_none()
        if not biz:
            raise NotFoundException("Business not found")
        branches = list((await self.db.execute(
            select(Vendor).where(Vendor.business_id == biz.id, Vendor.status == "active").order_by(Vendor.name)
        )).scalars().all())
        if not branches:
            raise NotFoundException("Business not found")
        return biz, branches

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

    async def set_store_open(self, user_id: str, is_open: bool) -> Vendor:
        vendor = await self._get_vendor_for_user(user_id)
        vendor.is_open = is_open
        await self.db.commit()
        await self.db.refresh(vendor)
        return vendor

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
            vendor.logo_url = data.logo_url or None  # an empty string removes the logo

        # Structured fields (street, town/city, state, LGA, landmark) win; the single free-text
        # `address` is still accepted from older app versions.
        from core.address import apply_structured_address
        geocode_query = apply_structured_address(vendor, data)
        if geocode_query is None and data.address is not None:
            vendor.address = data.address
            geocode_query = data.address
        if data.lat is not None and data.lng is not None:
            # Sent explicitly (the device's own position): more reliable than looking up an address.
            vendor.lat, vendor.lng = data.lat, data.lng
        elif geocode_query is not None:
            from core.geocoding import geocode_address
            coords = await geocode_address(geocode_query)
            # Best-effort: a vendor whose address couldn't be geocoded keeps whatever
            # coordinates it had (or none), and falls back to the flat delivery fee.
            if coords:
                vendor.lat, vendor.lng = coords

        return vendor

    async def create_product(self, user_id: str, data: CreateProductRequest) -> Product:
        vendor = await self._get_vendor_for_user(user_id)
        category_id = uuid.UUID(data.category_id) if data.category_id else None
        product = Product(
            vendor_id=vendor.id,
            category_id=category_id,
            name=data.name,
            description=data.description,
            # Not public until an admin approves it and sets the price customers will see; until
            # then price_kobo just mirrors the vendor's own price.
            price_kobo=data.price_kobo,
            vendor_price_kobo=data.price_kobo,
            approval_status="PENDING",
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

        # Anything customers read or judge a product by (its name, description, photos, or the
        # price) needs an admin's say-so. If the vendor changes one of those, a live product goes
        # back to review, so customers never see words, pictures or a price nobody signed off.
        # Stock and category changes don't: the vendor's stock is theirs, and admins fix categories.
        needs_review = False
        if data.name is not None and data.name != product.name:
            product.name = data.name
            needs_review = True
        if data.description is not None and data.description != (product.description or ""):
            product.description = data.description
            needs_review = True
        if data.image_urls is not None and list(data.image_urls) != list(product.image_urls or []):
            product.image_urls = data.image_urls
            needs_review = True
        if data.price_kobo is not None and data.price_kobo != product.vendor_price_kobo:
            product.vendor_price_kobo = data.price_kobo
            needs_review = True
        if needs_review or product.approval_status == "REJECTED":
            # A rejected product the vendor edited is resubmitted; a live one goes back for review.
            product.approval_status = "PENDING"
            product.rejection_reason = None
        if data.stock_qty is not None:
            product.stock_qty = data.stock_qty
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
        # The holder's name is whatever the bank says it is, never what the client typed, so a
        # hijacked session cannot label someone else's account with the vendor's legal name.
        try:
            verified = await provider.resolve_account(account_number, bank_code)
        except Exception as exc:  # noqa: BLE001
            raise ValidationException("We could not confirm that bank account. Check the number and the bank.") from exc
        account_name = verified.account_name
        result = await provider.create_transfer_recipient(account_name, account_number, bank_code)
        previous = vendor.payout_account_number
        vendor.paystack_recipient_code = result.recipient_code
        vendor.payout_account_number = account_number
        vendor.payout_bank_name = bank_name
        vendor.payout_account_name = account_name
        if previous and previous != account_number:
            await self._announce_payout_change(user_id, "vendor", vendor.id, f"••••{previous[-4:]}", f"••••{account_number[-4:]}")
        return vendor

    async def _announce_payout_change(self, user_id: str, kind: str, owner_id: object, before: str | None, after: str) -> None:
        """Tell the owner their payout account was replaced, and leave the entry the withdrawal
        cooling-off period reads. Someone who has hijacked a session can swap the account, so the
        real owner must hear about it, and the money cannot leave for 24 hours."""
        from datetime import UTC, datetime

        from services.analytics.audit import record_audit
        from services.notification.models import Notification

        record_audit(self.db, user_id, "payout.account_change", kind, str(owner_id), {"account": before}, {"account": after})
        self.db.add(Notification(
            user_id=uuid.UUID(user_id), type="payout_account_changed", channel="in_app", sent_at=datetime.now(UTC),
            content={"title": "Payout account changed",
                     "body": "Your payout bank account was changed. If this was not you, change your password and contact AVDAN now. "
                             "For your security, withdrawals are paused for 24 hours after a change."},
        ))
        try:
            from workers.tasks.notifications import notify_user_notice

            notify_user_notice.apply_async(
                args=[user_id, "Your payout account was changed",
                      "Your AVDAN payout bank account was just changed. If this was not you, reset your password and contact AVDAN "
                      "immediately. Withdrawals are paused for 24 hours after a change."],
                countdown=3,
            )
        except Exception:  # noqa: BLE001 - the in-app notice and the cooling-off are already recorded
            pass

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
