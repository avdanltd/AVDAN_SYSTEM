"""Admin service — user management operations."""
from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta

from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.exceptions import NotFoundException, ValidationException
from services.analytics.audit import record_audit
from services.auth.models import User
from services.orders.models import Order, OrderEvent
from services.vendor.models import Product, Vendor

_LAGOS = "Africa/Lagos"


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_users(
        self,
        role: str | None,
        status: str | None,
        page: int,
        page_size: int,
        search: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> tuple[list[User], int]:
        query = select(User)
        count_query = select(func.count()).select_from(User)

        joined = self._joined_between(date_from, date_to)
        if joined:
            query = query.where(*joined)
            count_query = count_query.where(*joined)

        term = (search or "").strip()
        if term:
            # Substring match on name, email or phone; escape LIKE wildcards typed by the admin.
            escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            match = or_(
                User.name.ilike(pattern, escape="\\"),
                User.email.ilike(pattern, escape="\\"),
                User.phone.ilike(pattern, escape="\\"),
            )
            query = query.where(match)
            count_query = count_query.where(match)

        if role:
            query = query.where(User.role == role)
            count_query = count_query.where(User.role == role)
        if status:
            query = query.where(User.status == status)
            count_query = count_query.where(User.status == status)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        offset = (page - 1) * page_size
        query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
        result = await self.db.execute(query)
        users = list(result.scalars().all())

        return users, total

    # ── New-user numbers ──────────────────────────────────────────────────────

    @staticmethod
    def _joined_between(date_from: date | None, date_to: date | None) -> list:  # type: ignore[type-arg]
        """`created_at` conditions for an inclusive Lagos-time date range (the admins' calendar)."""
        local = func.timezone(_LAGOS, User.created_at)
        conds = []
        if date_from:
            conds.append(local >= datetime.combine(date_from, time.min))
        if date_to:
            conds.append(local < datetime.combine(date_to + timedelta(days=1), time.min))
        return conds

    async def new_user_stats(
        self, date_from: date | None, date_to: date | None, role: str | None, bucket: str | None
    ) -> dict:
        """How many accounts were created in a period: totals by role plus a time series.

        `bucket` is day / week / month; when omitted it follows the span (up to ~5 weeks -> days,
        up to ~4 months -> weeks, longer -> months). Counts every account created, including ones
        still waiting on email verification and staff accounts still at the invited stage."""
        local = func.timezone(_LAGOS, User.created_at)
        conds = self._joined_between(date_from, date_to)
        if role:
            conds.append(User.role == role)

        by_role_rows = (await self.db.execute(
            select(User.role, func.count()).where(*conds).group_by(User.role)
        )).all()
        by_role = {r: n for r, n in by_role_rows}
        total = sum(by_role.values())
        active = (await self.db.execute(
            select(func.count()).select_from(User).where(*conds, User.status == "active")
        )).scalar_one()

        first_seen = (await self.db.execute(select(func.min(local)).where(*conds))).scalar_one()
        start = date_from or (first_seen.date() if first_seen else date.today())
        end = date_to or date.today()
        span_days = max((end - start).days + 1, 1)
        unit = bucket if bucket in ("day", "week", "month") else (
            "day" if span_days <= 35 else "week" if span_days <= 120 else "month"
        )

        trunc = func.date_trunc(unit, local)
        rows = (await self.db.execute(
            select(trunc, User.role, func.count()).where(*conds).group_by(trunc, User.role).order_by(trunc)
        )).all()
        points: dict[str, dict] = {}
        for b, r_, n in rows:
            key = b.date().isoformat()
            point = points.setdefault(key, {"bucket": key, "total": 0, "by_role": {}})
            point["total"] += n
            point["by_role"][r_] = n

        # Fill empty buckets so a quiet day shows as zero instead of vanishing from the chart.
        series: list[dict] = []
        cursor = self._bucket_start(start, unit)
        last = self._bucket_start(end, unit)
        while cursor <= last and len(series) < 400:
            key = cursor.isoformat()
            series.append(points.get(key, {"bucket": key, "total": 0, "by_role": {}}))
            cursor = self._next_bucket(cursor, unit)

        return {
            "date_from": start.isoformat(), "date_to": end.isoformat(), "bucket": unit,
            "total": total, "active": active, "by_role": by_role, "series": series,
        }

    @staticmethod
    def _bucket_start(d: date, unit: str) -> date:
        if unit == "week":
            return d - timedelta(days=d.weekday())  # Monday, as Postgres date_trunc('week')
        if unit == "month":
            return d.replace(day=1)
        return d

    @staticmethod
    def _next_bucket(d: date, unit: str) -> date:
        if unit == "week":
            return d + timedelta(days=7)
        if unit == "month":
            return (d.replace(day=28) + timedelta(days=4)).replace(day=1)
        return d + timedelta(days=1)

    async def update_user_status(self, user_id: str, new_status: str) -> tuple[User, str]:
        """Returns (user, previous status) so the caller can write the audit entry."""
        result = await self.db.execute(select(User).where(User.id == user_id))  # type: ignore[arg-type]
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundException("User not found")

        if user.status == "invited":
            # Nobody has set a password yet: activating would create a login nobody can use.
            raise ValidationException(
                "This account hasn't been set up yet. Resend the invitation or revoke it instead."
            )
        before = user.status
        user.status = new_status
        return user, before

    # ── Vendor management ─────────────────────────────────────────────────────

    @staticmethod
    def _incomplete_vendor_condition():  # type: ignore[no-untyped-def]
        """SQL twin of `vendor_checklist`'s required items (needs User joined): a vendor that has
        not filled in location, street, map pin, a real description or a phone number. Rejected
        vendors are left out, there is nothing left to chase."""
        def blank(col):  # type: ignore[no-untyped-def]
            return func.length(func.trim(func.coalesce(col, ""))) == 0

        return and_(
            Vendor.status != "rejected",
            or_(
                blank(Vendor.state), blank(Vendor.lga), blank(Vendor.city), blank(Vendor.street),
                Vendor.lat.is_(None), Vendor.lng.is_(None),
                func.length(func.trim(func.coalesce(Vendor.description, ""))) < 20,
                blank(User.phone),
            ),
        )

    async def vendor_counts(self) -> dict[str, int]:
        """How many vendors in each status, plus how many have not filled all requirements, for
        the numbers in the filter dropdown."""
        by_status = dict((await self.db.execute(select(Vendor.status, func.count()).group_by(Vendor.status))).all())
        incomplete = (await self.db.execute(
            select(func.count()).select_from(Vendor).join(User, User.id == Vendor.user_id)
            .where(self._incomplete_vendor_condition())
        )).scalar_one()
        return {
            "all": sum(by_status.values()),
            "pending": by_status.get("pending", 0), "active": by_status.get("active", 0),
            "suspended": by_status.get("suspended", 0), "rejected": by_status.get("rejected", 0),
            "incomplete": incomplete,
        }

    async def list_vendors(
        self,
        status: str | None,
        page: int,
        page_size: int,
        incomplete: bool = False,
    ) -> tuple[list[Vendor], int]:
        query = select(Vendor).join(User, User.id == Vendor.user_id)
        count_query = select(func.count()).select_from(Vendor).join(User, User.id == Vendor.user_id)

        if status:
            query = query.where(Vendor.status == status)
            count_query = count_query.where(Vendor.status == status)
        if incomplete:
            query = query.where(self._incomplete_vendor_condition())
            count_query = count_query.where(self._incomplete_vendor_condition())

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        offset = (page - 1) * page_size
        query = query.order_by(Vendor.created_at.desc()).offset(offset).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    # ── Vendor application review ─────────────────────────────────────────────

    @staticmethod
    def vendor_checklist(v: Vendor, owner: User | None) -> list[dict]:
        """What an admin checks before approving a vendor. `required` items that are not ok are
        what to chase; the rest are worth knowing but don't block a store opening."""
        place = [x for x in (v.state, v.lga, v.city) if x and x.strip()]
        missing_place = [lbl for lbl, val in (("state", v.state), ("LGA", v.lga), ("city", v.city)) if not (val and val.strip())]
        desc = (v.description or "").strip()
        return [
            {
                "key": "location", "label": "Location (state, LGA, city)", "required": True,
                "ok": not missing_place,
                "detail": " · ".join(reversed(place)) if not missing_place else f"Missing: {', '.join(missing_place)}",
            },
            {
                "key": "street", "label": "Street address", "required": True,
                "ok": bool(v.street and v.street.strip()),
                "detail": (v.street or None) if v.street and v.street.strip() else (
                    f"Only a free-text address is saved: {v.address}" if v.address else "Not entered"
                ),
            },
            {
                "key": "pickup_pin", "label": "Pickup point pinned on the map", "required": True,
                "ok": v.lat is not None and v.lng is not None,
                "detail": f"{float(v.lat):.5f}, {float(v.lng):.5f}" if v.lat is not None and v.lng is not None
                else "Not pinned: riders can't be matched by distance and customers pay only the flat delivery fee",
            },
            {
                "key": "description", "label": "Business description", "required": True,
                "ok": len(desc) >= 20,
                "detail": f"{len(desc)} characters" if desc else "Not written",
            },
            {
                "key": "phone", "label": "Contact phone number", "required": True,
                "ok": bool(owner and owner.phone), "detail": owner.phone if owner and owner.phone else "Not set",
            },
            {
                "key": "logo", "label": "Logo", "required": False,
                "ok": bool(v.logo_url), "detail": None if v.logo_url else "No logo uploaded",
            },
            {
                "key": "payout", "label": "Payout bank account", "required": False,
                "ok": bool(v.payout_account_number),
                "detail": v.payout_bank_name if v.payout_account_number else "Not added yet (needed before a payout)",
            },
        ]

    async def vendor_profile(self, vendor_id: str) -> dict:
        """Everything an admin needs to decide on a vendor: what they filled in, who they are,
        what they've listed, and what is still missing."""
        from services.vendor.messages import unread_count

        vendor = (await self.db.execute(
            select(Vendor).where(Vendor.id == uuid.UUID(vendor_id)).options(selectinload(Vendor.user))
        )).scalar_one_or_none()
        if not vendor:
            raise NotFoundException("Vendor not found")

        counts = dict((await self.db.execute(
            select(Product.approval_status, func.count()).where(Product.vendor_id == vendor.id).group_by(Product.approval_status)
        )).all())
        from services.vendor.business import my_status

        branch = await my_status(self.db, vendor)
        checklist = self.vendor_checklist(vendor, vendor.user)
        acct = vendor.payout_account_number
        return {
            "id": str(vendor.id), "name": vendor.name, "slug": vendor.slug, "status": vendor.status,
            "description": vendor.description, "logo_url": vendor.logo_url, "is_open": vendor.is_open,
            "created_at": vendor.created_at.isoformat(),
            "address": vendor.address, "street": vendor.street, "city": vendor.city, "lga": vendor.lga,
            "state": vendor.state, "country": vendor.country, "landmark": vendor.landmark,
            "lat": float(vendor.lat) if vendor.lat is not None else None,
            "lng": float(vendor.lng) if vendor.lng is not None else None,
            "owner_name": vendor.user.name if vendor.user else None,
            "owner_email": vendor.user.email if vendor.user else None,
            "owner_phone": vendor.user.phone if vendor.user else None,
            "owner_status": vendor.user.status if vendor.user else None,
            "payout_bank_name": vendor.payout_bank_name,
            "payout_account_name": vendor.payout_account_name,
            "payout_account_last4": acct[-4:] if acct else None,
            "product_total": sum(counts.values()),
            "product_approved": counts.get("APPROVED", 0),
            "product_pending": counts.get("PENDING", 0),
            "checklist": checklist,
            "missing": [c["label"] for c in checklist if c["required"] and not c["ok"]],
            "unread_from_vendor": await unread_count(self.db, vendor.id, "admin"),
            "business": branch["business"],
            "link_request": branch["request"],
        }

    async def get_vendor(self, vendor_id: str) -> Vendor:
        vendor = (await self.db.execute(select(Vendor).where(Vendor.id == uuid.UUID(vendor_id)))).scalar_one_or_none()
        if not vendor:
            raise NotFoundException("Vendor not found")
        return vendor

    async def update_vendor_status(self, vendor_id: str, new_status: str) -> tuple[Vendor, str]:
        result = await self.db.execute(
            select(Vendor).where(Vendor.id == uuid.UUID(vendor_id))
        )
        vendor = result.scalar_one_or_none()
        if not vendor:
            raise NotFoundException("Vendor not found")

        before = vendor.status
        vendor.status = new_status
        return vendor, before

    # ── Product approval ──────────────────────────────────────────────────────

    async def list_products(
        self,
        approval_status: str | None,
        vendor_id: str | None,
        page: int,
        page_size: int,
        search: str | None = None,
    ) -> tuple[list[Product], int]:
        query = select(Product).options(selectinload(Product.vendor), selectinload(Product.category))
        count_query = select(func.count()).select_from(Product)
        if search and search.strip():
            # Product name or vendor name, as the admin types.
            pattern = f"%{search.strip()}%"
            match = or_(
                Product.name.ilike(pattern),
                Product.vendor_id.in_(select(Vendor.id).where(Vendor.name.ilike(pattern))),
            )
            query = query.where(match)
            count_query = count_query.where(match)
        if approval_status:
            query = query.where(Product.approval_status == approval_status)
            count_query = count_query.where(Product.approval_status == approval_status)
        if vendor_id:
            query = query.where(Product.vendor_id == uuid.UUID(vendor_id))
            count_query = count_query.where(Product.vendor_id == uuid.UUID(vendor_id))
        total = (await self.db.execute(count_query)).scalar_one()
        # Oldest first, so the review queue is worked in the order vendors submitted.
        query = query.order_by(Product.created_at.asc()).offset((page - 1) * page_size).limit(page_size)
        return list((await self.db.execute(query)).scalars().all()), total

    async def product_vendor_summaries(
        self, search: str | None, page: int, page_size: int
    ) -> tuple[list[dict], int]:
        """Vendors that have products, with how many are live / awaiting approval / rejected, so
        admins review one vendor's catalogue at a time instead of one giant list. Vendors with
        something waiting come first."""
        counts = (
            select(
                Product.vendor_id.label("vendor_id"),
                func.count().label("total"),
                func.count().filter(Product.approval_status == "APPROVED").label("live"),
                func.count().filter(Product.approval_status == "PENDING").label("pending"),
                func.count().filter(Product.approval_status == "REJECTED").label("rejected"),
            )
            .group_by(Product.vendor_id)
            .subquery()
        )
        q = select(Vendor, counts.c.total, counts.c.live, counts.c.pending, counts.c.rejected).join(
            counts, counts.c.vendor_id == Vendor.id
        )
        cq = select(func.count()).select_from(Vendor).join(counts, counts.c.vendor_id == Vendor.id)
        if search and search.strip():
            pattern = f"%{search.strip()}%"
            q = q.where(Vendor.name.ilike(pattern))
            cq = cq.where(Vendor.name.ilike(pattern))
        total = (await self.db.execute(cq)).scalar_one()
        rows = (await self.db.execute(
            q.order_by(counts.c.pending.desc(), Vendor.name.asc()).offset((page - 1) * page_size).limit(page_size)
        )).all()
        return [
            {
                "vendor_id": str(v.id), "name": v.name, "status": v.status, "logo_url": v.logo_url,
                "total": t, "live": live, "pending": pending, "rejected": rejected,
            }
            for v, t, live, pending, rejected in rows
        ], total

    async def _get_product(self, product_id: str) -> Product:
        product = (await self.db.execute(
            select(Product)
            .where(Product.id == uuid.UUID(product_id))
            .options(selectinload(Product.vendor), selectinload(Product.category))
        )).scalar_one_or_none()
        if not product:
            raise NotFoundException("Product not found")
        return product

    async def set_product_category(self, product_id: str, category_id: str | None) -> tuple[Product, str | None]:
        """Move a product to another category (or none). Returns (product, previous category id)."""
        from services.categories.models import Category

        product = await self._get_product(product_id)
        before = str(product.category_id) if product.category_id else None
        if category_id:
            cat = (await self.db.execute(select(Category).where(Category.id == uuid.UUID(category_id)))).scalar_one_or_none()
            if not cat:
                raise NotFoundException("Category not found")
            product.category_id = cat.id
            product.category = cat
        else:
            product.category_id = None
            product.category = None
        return product, before

    async def approve_product(
        self,
        product_id: str,
        price_kobo: int,
        discount_type: str | None = None,
        discount_value: int | None = None,
        special_delivery_fee_kobo: int | None = None,
    ) -> Product:
        """Approve (or re-price) a product. `price_kobo` is the shown price; an optional discount
        (fixed kobo or whole percent) comes off it, and the result is what customers pay. The
        vendor is always paid their own price, so the discounted price can never fall below it:
        a discount only eats into the platform's markup."""
        product = await self._get_product(product_id)
        if price_kobo < product.vendor_price_kobo:
            raise ValidationException(
                f"The shown price can't be below the vendor's price of ₦{product.vendor_price_kobo / 100:,.2f}."
            )

        final = price_kobo
        if discount_type:
            if not discount_value:
                raise ValidationException("Enter the discount amount.")
            if discount_type == "PERCENT":
                if discount_value >= 100:
                    raise ValidationException("A percentage discount must be below 100%.")
                final = price_kobo - price_kobo * discount_value // 100
            else:
                final = price_kobo - discount_value
            if final < product.vendor_price_kobo:
                raise ValidationException(
                    f"This discount takes the price to ₦{max(final, 0) / 100:,.2f}, below the vendor's price of "
                    f"₦{product.vendor_price_kobo / 100:,.2f}. The vendor must still be paid in full, so the "
                    f"largest discount here is ₦{(price_kobo - product.vendor_price_kobo) / 100:,.2f}."
                )
        elif discount_value:
            raise ValidationException("Choose a discount type (fixed or percentage).")

        product.price_kobo = final
        product.compare_at_price_kobo = price_kobo if discount_type else None
        product.discount_type = discount_type or None
        product.discount_value = discount_value if discount_type else None
        if special_delivery_fee_kobo is not None:
            product.special_delivery_fee_kobo = special_delivery_fee_kobo
        product.approval_status = "APPROVED"
        product.rejection_reason = None
        return product

    async def reject_product(self, product_id: str, reason: str) -> Product:
        product = await self._get_product(product_id)
        product.approval_status = "REJECTED"
        product.rejection_reason = reason
        return product

    # ── Order management ──────────────────────────────────────────────────────

    # ── Order numbers ─────────────────────────────────────────────────────────

    # The groups the admin reads order volume by. One source of truth: the stats endpoint returns
    # these (with counts) so the chips, the chart and the list filter can never disagree.
    ORDER_GROUPS: list[tuple[str, str, list[str]]] = [
        ("pending", "Awaiting payment", ["PENDING"]),
        ("in_progress", "In progress", [
            "PAID", "VENDOR_ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP",
            "IN_TRANSIT_TO_HUB", "ARRIVED_AT_HUB", "AT_HUB", "QA_IN_PROGRESS", "QA_PASSED",
            "QA_FAILED", "VENDOR_REMEDIATION", "OUT_FOR_DELIVERY",
        ]),
        ("delivered", "Delivered", ["DELIVERED"]),
        ("release_pending", "Release pending", ["PAYMENT_RELEASE_PENDING"]),
        ("completed", "Completed", ["PAYMENT_RELEASED", "COMPLETED"]),
        ("cancelled", "Cancelled / rejected", ["CANCELLED", "VENDOR_REJECTED"]),
        ("issues", "Disputes & refunds", ["DISPUTED", "DISPUTE_RESOLVED", "REFUND_INITIATED", "FAILED_DELIVERY"]),
    ]
    # Orders that never turned into money: unpaid, cancelled before/after, or rejected by the vendor.
    _NO_VALUE = ["PENDING", "CANCELLED", "VENDOR_REJECTED"]

    @staticmethod
    def _ordered_between(date_from: date | None, date_to: date | None) -> list:  # type: ignore[type-arg]
        """`created_at` conditions for an inclusive Lagos-time date range."""
        local = func.timezone(_LAGOS, Order.created_at)
        conds = []
        if date_from:
            conds.append(local >= datetime.combine(date_from, time.min))
        if date_to:
            conds.append(local < datetime.combine(date_to + timedelta(days=1), time.min))
        return conds

    async def order_status_counts(self, date_from: date | None, date_to: date | None) -> dict[str, int]:
        """Orders per exact status in a period (Lagos dates), for the numbers in the status dropdown."""
        conds = self._ordered_between(date_from, date_to)
        rows = (await self.db.execute(select(Order.status, func.count()).where(*conds).group_by(Order.status))).all()
        counts = {st: n for st, n in rows}
        counts["__all__"] = sum(counts.values())
        return counts

    async def user_counts(self) -> dict:
        by_role = dict((await self.db.execute(select(User.role, func.count()).group_by(User.role))).all())
        by_status = dict((await self.db.execute(select(User.status, func.count()).group_by(User.status))).all())
        return {"total": sum(by_role.values()), "by_role": by_role, "by_status": by_status}

    async def product_counts(self, vendor_id: str | None) -> dict[str, int]:
        q = select(Product.approval_status, func.count()).group_by(Product.approval_status)
        if vendor_id:
            q = q.where(Product.vendor_id == uuid.UUID(vendor_id))
        counts = {st: n for st, n in (await self.db.execute(q)).all()}
        counts["__all__"] = sum(counts.values())
        return counts

    async def order_stats(
        self,
        date_from: date | None,
        date_to: date | None,
        group: str | None,
        bucket: str | None,
        vendor_id: uuid.UUID | None = None,
    ) -> dict:
        """How many orders were placed in a period: counts per status group plus a time series.

        Chip counts (`groups`) always cover every group so they stay put while one is selected;
        `total`, `value_kobo` and the series follow the selected `group`."""
        local = func.timezone(_LAGOS, Order.created_at)
        conds = self._ordered_between(date_from, date_to)
        # Scoped to one vendor (their own dashboard): same numbers, same groups, and the value is
        # what the vendor earns from the goods (their own price), not what the customer paid.
        value_col = Order.total_kobo + Order.delivery_fee_kobo
        if vendor_id is not None:
            conds.append(Order.vendor_id == vendor_id)
            value_col = func.coalesce(Order.vendor_total_kobo, Order.total_kobo)

        status_rows = (await self.db.execute(
            select(Order.status, func.count()).where(*conds).group_by(Order.status)
        )).all()
        by_status = {s_: n for s_, n in status_rows}
        status_to_group = {st: key for key, _, sts in self.ORDER_GROUPS for st in sts}

        groups = []
        for key, label, sts in self.ORDER_GROUPS:
            groups.append({
                "key": key, "label": label, "statuses": sts,
                "count": sum(by_status.get(st, 0) for st in sts),
            })
        # A status added later but not grouped yet still counts, under "in progress".
        stray = sum(n for st, n in by_status.items() if st not in status_to_group)
        if stray:
            groups[1]["count"] += stray

        selected = next((g for g in self.ORDER_GROUPS if g[0] == group), None)
        if selected:
            conds.append(Order.status.in_(selected[2]))

        total = (await self.db.execute(select(func.count()).select_from(Order).where(*conds))).scalar_one()
        value = (await self.db.execute(
            select(func.coalesce(func.sum(value_col), 0))
            .where(*conds, Order.status.notin_(self._NO_VALUE))
        )).scalar_one()

        first_seen = (await self.db.execute(select(func.min(local)).where(*conds))).scalar_one()
        start = date_from or (first_seen.date() if first_seen else date.today())
        end = date_to or date.today()
        span_days = max((end - start).days + 1, 1)
        unit = bucket if bucket in ("day", "week", "month") else (
            "day" if span_days <= 35 else "week" if span_days <= 120 else "month"
        )

        trunc = func.date_trunc(unit, local)
        rows = (await self.db.execute(
            select(trunc, Order.status, func.count()).where(*conds).group_by(trunc, Order.status).order_by(trunc)
        )).all()
        points: dict[str, dict] = {}
        for b, st, n in rows:
            key = b.date().isoformat()
            point = points.setdefault(key, {"bucket": key, "total": 0, "by_group": {}})
            g = status_to_group.get(st, "in_progress")
            point["total"] += n
            point["by_group"][g] = point["by_group"].get(g, 0) + n

        series: list[dict] = []
        cursor = self._bucket_start(start, unit)
        last = self._bucket_start(end, unit)
        while cursor <= last and len(series) < 400:
            key = cursor.isoformat()
            series.append(points.get(key, {"bucket": key, "total": 0, "by_group": {}}))
            cursor = self._next_bucket(cursor, unit)

        return {
            "date_from": start.isoformat(), "date_to": end.isoformat(), "bucket": unit,
            "total": total, "value_kobo": int(value), "groups": groups, "series": series,
        }

    async def list_orders(
        self,
        status: str | None,
        vendor_id: str | None,
        customer_id: str | None,
        page: int,
        page_size: int,
        search: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> tuple[list[Order], int]:
        query = select(Order)
        count_query = select(func.count()).select_from(Order)

        extra = self._ordered_between(date_from, date_to)
        if search and search.strip():
            term = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            extra.append(cast(Order.id, String).ilike(f"{term}%", escape="\\"))
        for cond in extra:
            query = query.where(cond)
            count_query = count_query.where(cond)

        if status:
            statuses = [s.strip() for s in status.split(",") if s.strip()]
            status_filter = Order.status.in_(statuses) if len(statuses) > 1 else Order.status == statuses[0]
            query = query.where(status_filter)
            count_query = count_query.where(status_filter)
        if vendor_id:
            query = query.where(Order.vendor_id == uuid.UUID(vendor_id))
            count_query = count_query.where(Order.vendor_id == uuid.UUID(vendor_id))
        if customer_id:
            query = query.where(Order.customer_id == uuid.UUID(customer_id))
            count_query = count_query.where(Order.customer_id == uuid.UUID(customer_id))

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            query
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_order_detail(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order)
            .where(Order.id == uuid.UUID(order_id))
            .options(selectinload(Order.items), selectinload(Order.events))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        return order

    async def attention_counts(self) -> dict:
        from services.dispute.models import Dispute
        from services.orders.state_machine import OrderStatus
        from services.vendor.models import Product, Vendor
        from services.wallet.models import PayoutRequest, PayoutStatus

        async def count(model, *where):  # type: ignore[no-untyped-def]
            return int((await self.db.execute(
                select(func.count()).select_from(model).where(*where)
            )).scalar_one())

        return {
            "products": await count(Product, Product.approval_status == "PENDING"),
            "vendors": await count(Vendor, Vendor.status == "pending"),
            "payouts": await count(PayoutRequest, PayoutRequest.status == PayoutStatus.REQUESTED),
            "disputes": await count(Dispute, Dispute.status.in_(["open", "under_review"])),
            # Ready for pickup with nobody assigned yet.
            "dispatch": await count(
                Order, Order.status == OrderStatus.READY_FOR_PICKUP, Order.rider_id.is_(None)
            ),
        }

    # ── Hub management ────────────────────────────────────────────────────────

    async def list_hubs(self) -> list:
        from services.qa.models import AgentHub
        result = await self.db.execute(select(AgentHub).order_by(AgentHub.name))
        return list(result.scalars().all())

    async def create_hub(self, name: str, capacity: int, lat: float | None, lng: float | None):
        from services.qa.models import AgentHub
        hub = AgentHub(name=name, capacity=capacity, lat=lat, lng=lng)
        self.db.add(hub)
        await self.db.flush()
        await self.db.refresh(hub)
        return hub

    async def update_hub(self, hub_id: str, name: str, capacity: int):
        import uuid as _uuid

        from services.qa.models import AgentHub
        result = await self.db.execute(
            select(AgentHub).where(AgentHub.id == _uuid.UUID(hub_id))
        )
        hub = result.scalar_one_or_none()
        if not hub:
            raise NotFoundException("Hub not found")
        hub.name = name
        hub.capacity = capacity
        await self.db.flush()
        return hub

    async def delete_hub(self, hub_id: str) -> None:
        import uuid as _uuid

        from services.qa.models import AgentHub
        result = await self.db.execute(
            select(AgentHub).where(AgentHub.id == _uuid.UUID(hub_id))
        )
        hub = result.scalar_one_or_none()
        if not hub:
            raise NotFoundException("Hub not found")
        # Unassign any agents pointing to this hub
        agent_result = await self.db.execute(
            select(User).where(User.hub_id == hub.id)
        )
        for agent in agent_result.scalars().all():
            agent.hub_id = None
        await self.db.delete(hub)
        await self.db.flush()

    async def assign_agent_hub(self, user_id: str, hub_id: str | None) -> User:
        import uuid as _uuid
        result = await self.db.execute(select(User).where(User.id == user_id))  # type: ignore[arg-type]
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundException("User not found")
        user.hub_id = _uuid.UUID(hub_id) if hub_id else None
        await self.db.flush()
        return user

    async def override_order_status(
        self, order_id: str, new_status: str, reason: str, admin_id: str
    ) -> Order:
        result = await self.db.execute(
            select(Order).where(Order.id == uuid.UUID(order_id))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")

        self.db.add(
            OrderEvent(
                order_id=order.id,
                from_state=order.status,
                to_state=new_status,
                actor_id=uuid.UUID(admin_id),
                actor_role="admin",
                event_metadata={"reason": reason, "manual_override": True},
            )
        )
        record_audit(
            self.db, admin_id, "order.status_override", "order", order.id,
            {"status": order.status}, {"status": new_status, "reason": reason},
        )
        order.status = new_status
        await self.db.flush()
        # The caller serialises the order (items, updated_at). Reload it with its items now: a
        # lazy load inside the response builder runs outside the async greenlet and crashed
        # every override with a 500, so no override ever saved.
        refreshed = await self.db.execute(
            select(Order)
            .where(Order.id == order.id)
            .options(selectinload(Order.items))
            .execution_options(populate_existing=True)
        )
        return refreshed.scalar_one()
