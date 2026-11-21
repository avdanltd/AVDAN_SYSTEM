"""Branches: grouping independent vendor accounts under one Business for customers.

Every branch keeps its own login, products, orders and wallet; a Business only decides what the
marketplace shows (one brand, several locations). There is no head office: every vendor is just a
branch, and the people who decide who belongs to a brand are AVDAN admins.

Flow: a vendor says "we are a branch of X" (an existing business, a standalone vendor, or just a
brand name), an admin vets it (evidence hints below, plus messaging the vendor for proof) and
approves or rejects. A vendor can leave on its own; only an admin can remove someone else.
"""
from __future__ import annotations

import difflib
import re
import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import NotFoundException, ValidationException
from services.auth.models import User
from services.notification.models import Notification
from services.vendor.models import Business, BusinessLinkRequest, Vendor

_GENERIC_MAIL = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "protonmail.com"}


def _clean(text: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


async def _unique_slug(db: AsyncSession, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "business"
    taken = (await db.execute(select(Business.id).where(Business.slug == base))).first()
    return base if not taken else f"{base}-{secrets.token_hex(3)}"


def place_of(v: Vendor) -> str:
    return ", ".join(x for x in (v.city, v.state) if x and x.strip())


async def _vendor(db: AsyncSession, vendor_id: str | uuid.UUID) -> Vendor:
    v = (await db.execute(select(Vendor).where(Vendor.id == uuid.UUID(str(vendor_id))))).scalar_one_or_none()
    if not v:
        raise NotFoundException("Vendor not found")
    return v


async def branches_of(db: AsyncSession, business_id: uuid.UUID) -> list[Vendor]:
    return list((await db.execute(
        select(Vendor).where(Vendor.business_id == business_id).order_by(Vendor.name)
    )).scalars().all())


def _request_dict(r: BusinessLinkRequest, target_name: str | None) -> dict:
    return {
        "id": str(r.id), "status": r.status, "note": r.note, "reason": r.reason,
        "target_name": target_name or r.brand_name, "created_at": r.created_at.isoformat(),
    }


async def _target_name(db: AsyncSession, r: BusinessLinkRequest) -> str | None:
    if r.target_business_id:
        return (await db.execute(select(Business.name).where(Business.id == r.target_business_id))).scalar_one_or_none()
    if r.target_vendor_id:
        return (await db.execute(select(Vendor.name).where(Vendor.id == r.target_vendor_id))).scalar_one_or_none()
    return r.brand_name


# ── Vendor side ────────────────────────────────────────────────────────────────

async def my_status(db: AsyncSession, vendor: Vendor) -> dict:
    """Where this vendor stands: in a business (with its branches), waiting on a request, or free."""
    business = None
    if vendor.business_id:
        biz = (await db.execute(select(Business).where(Business.id == vendor.business_id))).scalar_one()
        business = {
            "id": str(biz.id), "name": biz.name, "slug": biz.slug,
            "branches": [
                {"vendor_id": str(b.id), "name": b.name, "place": place_of(b), "status": b.status, "is_you": b.id == vendor.id}
                for b in await branches_of(db, biz.id)
            ],
        }
    latest = (await db.execute(
        select(BusinessLinkRequest).where(BusinessLinkRequest.vendor_id == vendor.id)
        .order_by(BusinessLinkRequest.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    request = _request_dict(latest, await _target_name(db, latest)) if latest else None
    return {"business": business, "request": request}


async def suggest(db: AsyncSession, query: str, exclude_vendor: uuid.UUID, limit: int = 6) -> list[dict]:
    """Businesses and standalone vendors matching what a vendor is typing, so spelling differences
    don't create duplicate brands. Approved (active) stores only."""
    q = (query or "").strip()
    if len(q) < 2:
        return []
    pattern = f"%{q.replace('%', '').replace('_', '')}%"
    out: list[dict] = []
    for biz in (await db.execute(select(Business).where(Business.name.ilike(pattern)).limit(limit))).scalars().all():
        branches = await branches_of(db, biz.id)
        if any(b.id == exclude_vendor for b in branches):
            continue
        out.append({
            "kind": "business", "id": str(biz.id), "name": biz.name,
            "detail": f"{len(branches)} branch{'es' if len(branches) != 1 else ''}: "
                      + ", ".join(p for p in (place_of(b) for b in branches[:3]) if p),
        })
    for v in (await db.execute(
        select(Vendor).where(Vendor.name.ilike(pattern), Vendor.business_id.is_(None), Vendor.status == "active", Vendor.id != exclude_vendor).limit(limit)
    )).scalars().all():
        out.append({"kind": "vendor", "id": str(v.id), "name": v.name, "detail": place_of(v) or "Store on AVDAN"})
    return out[:limit]


async def request_join(
    db: AsyncSession, vendor: Vendor, *, business_id: str | None, vendor_id: str | None,
    brand_name: str | None, note: str | None,
) -> BusinessLinkRequest:
    if vendor.status in ("rejected", "suspended"):
        raise ValidationException("This store can't send requests right now.")
    if vendor.business_id:
        raise ValidationException("This store is already part of a business. Leave it first to join another.")
    given = [x for x in (business_id, vendor_id, (brand_name or "").strip() or None) if x]
    if len(given) != 1:
        raise ValidationException("Choose the business or store you belong to, or type its name.")
    pending = (await db.execute(
        select(BusinessLinkRequest.id).where(BusinessLinkRequest.vendor_id == vendor.id, BusinessLinkRequest.status == "pending")
    )).first()
    if pending:
        raise ValidationException("You already have a request waiting for AVDAN. Cancel it first to send a different one.")

    req = BusinessLinkRequest(vendor_id=vendor.id, note=(note or "").strip()[:1000] or None)
    if business_id:
        if not (await db.execute(select(Business.id).where(Business.id == uuid.UUID(business_id)))).first():
            raise NotFoundException("That business was not found.")
        req.target_business_id = uuid.UUID(business_id)
    elif vendor_id:
        target = await _vendor(db, vendor_id)
        if target.id == vendor.id:
            raise ValidationException("A store can't be a branch of itself.")
        if target.business_id:
            req.target_business_id = target.business_id
        else:
            req.target_vendor_id = target.id
    else:
        req.brand_name = (brand_name or "").strip()[:255]
    db.add(req)
    await db.flush()

    now = datetime.now(UTC)
    admins = (await db.execute(
        select(User.id).where(User.role.in_(["admin", "support"]), User.status == "active")
    )).scalars().all()
    for admin_id in admins:
        db.add(Notification(
            user_id=admin_id, type="branch_request", channel="in_app", sent_at=now,
            content={
                "title": "Branch link request",
                "body": f"{vendor.name} says it is a branch of {await _target_name(db, req)}.",
                "vendor_id": str(vendor.id), "request_id": str(req.id),
            },
        ))
    return req


async def cancel_request(db: AsyncSession, vendor: Vendor) -> None:
    req = (await db.execute(
        select(BusinessLinkRequest).where(BusinessLinkRequest.vendor_id == vendor.id, BusinessLinkRequest.status == "pending")
    )).scalar_one_or_none()
    if not req:
        raise ValidationException("You have no request waiting.")
    req.status = "cancelled"
    req.reviewed_at = datetime.now(UTC)


async def leave(db: AsyncSession, vendor: Vendor) -> None:
    """This store steps out of its business. Nobody else is affected; an emptied business is removed."""
    if not vendor.business_id:
        raise ValidationException("This store is not part of a business.")
    biz_id = vendor.business_id
    vendor.business_id = None
    await db.flush()
    await _drop_if_empty(db, biz_id)


async def _drop_if_empty(db: AsyncSession, business_id: uuid.UUID) -> None:
    left = (await db.execute(select(func.count()).select_from(Vendor).where(Vendor.business_id == business_id))).scalar_one()
    if left == 0:
        await db.execute(Business.__table__.delete().where(Business.id == business_id))


# ── Admin side ─────────────────────────────────────────────────────────────────

async def evidence(db: AsyncSession, req: BusinessLinkRequest) -> list[str]:
    """Hints for the admin deciding on a request. They only point things out; a person decides."""
    me = await _vendor(db, req.vendor_id)
    if req.target_business_id:
        others = await branches_of(db, req.target_business_id)
    elif req.target_vendor_id:
        others = [await _vendor(db, req.target_vendor_id)]
    else:
        others = []
    me_user = (await db.execute(select(User).where(User.id == me.user_id))).scalar_one_or_none()
    hints: list[str] = []
    for o in others:
        mine, theirs = _clean(me.name), _clean(o.name)
        ratio = difflib.SequenceMatcher(None, mine, theirs).ratio()
        first_mine, first_theirs = mine.split(" ")[0], theirs.split(" ")[0]
        # Branch names often share only a brand word ("20NINE SR" / "20NINE STALLION RESOURCES").
        if ratio >= 0.6 or (len(first_mine) >= 3 and first_mine == first_theirs):
            hints.append(f"Name is similar to {o.name} (both start with “{first_mine}”)" if ratio < 0.6
                         else f"Name is similar to {o.name} ({int(ratio * 100)}% match)")
        if me.payout_account_name and o.payout_account_name and _clean(me.payout_account_name) == _clean(o.payout_account_name):
            hints.append(f"Same payout account holder as {o.name}: {o.payout_account_name}")
        o_user = (await db.execute(select(User).where(User.id == o.user_id))).scalar_one_or_none()
        if me_user and o_user:
            my_dom = (me_user.email or "").split("@")[-1].lower()
            if my_dom and my_dom not in _GENERIC_MAIL and my_dom == (o_user.email or "").split("@")[-1].lower():
                hints.append(f"Same email domain as {o.name} (@{my_dom})")
            if me_user.name and o_user.name and _clean(me_user.name) == _clean(o_user.name):
                hints.append(f"Same owner name as {o.name}: {o_user.name}")
    if not others:
        hints.append("The other branches are not on AVDAN yet, so there is nothing to compare. Ask for proof.")
    elif not hints:
        hints.append("No matching details found. Ask the vendor for proof before approving.")
    return hints


async def list_requests(db: AsyncSession, status: str | None) -> list[dict]:
    q = select(BusinessLinkRequest).order_by(BusinessLinkRequest.created_at.desc()).limit(200)
    if status:
        q = q.where(BusinessLinkRequest.status == status)
    out = []
    for r in (await db.execute(q)).scalars().all():
        v = await _vendor(db, r.vendor_id)
        out.append({
            **_request_dict(r, await _target_name(db, r)),
            "vendor_id": str(v.id), "vendor_name": v.name, "vendor_place": place_of(v), "vendor_status": v.status,
            "hints": await evidence(db, r) if r.status == "pending" else [],
        })
    return out


async def _get_pending(db: AsyncSession, request_id: str) -> BusinessLinkRequest:
    r = (await db.execute(
        select(BusinessLinkRequest).where(BusinessLinkRequest.id == uuid.UUID(request_id)).with_for_update()
    )).scalar_one_or_none()
    if not r:
        raise NotFoundException("Request not found")
    if r.status != "pending":
        raise ValidationException(f"This request was already {r.status}.")
    return r


async def approve_request(db: AsyncSession, request_id: str, admin_user_id: str, business_name: str | None) -> Business:
    r = await _get_pending(db, request_id)
    me = await _vendor(db, r.vendor_id)
    if me.business_id:
        raise ValidationException("This vendor already joined a business.")
    name = (business_name or "").strip() or None

    if r.target_business_id:
        biz = (await db.execute(select(Business).where(Business.id == r.target_business_id))).scalar_one_or_none()
        if not biz:
            raise NotFoundException("That business no longer exists.")
    elif r.target_vendor_id:
        target = await _vendor(db, r.target_vendor_id)
        if target.business_id:
            biz = (await db.execute(select(Business).where(Business.id == target.business_id))).scalar_one()
        else:
            biz = Business(name=name or target.name, slug=await _unique_slug(db, name or target.name))
            db.add(biz)
            await db.flush()
            target.business_id = biz.id
    else:
        biz = Business(name=name or (r.brand_name or me.name), slug=await _unique_slug(db, name or r.brand_name or me.name))
        db.add(biz)
        await db.flush()
    others_before = [b for b in await branches_of(db, biz.id) if b.id != me.id]
    me.business_id = biz.id
    if name and r.target_business_id and biz.name != name:
        biz.name = name
    r.status = "approved"
    r.reviewed_by = uuid.UUID(admin_user_id)
    r.reviewed_at = datetime.now(UTC)
    await db.flush()

    now = datetime.now(UTC)
    # Tell the new branch, and the branches already there, so nobody is attached unnoticed.
    db.add(Notification(user_id=me.user_id, type="branch_decision", channel="in_app", sent_at=now, content={
        "title": "You're linked", "body": f"{me.name} is now shown to customers as a branch of {biz.name}.",
    }))
    for o in others_before:
        db.add(Notification(user_id=o.user_id, type="branch_joined", channel="in_app", sent_at=now, content={
            "title": "New branch linked", "body": f"{me.name} ({place_of(me) or 'location not set'}) was linked to {biz.name}.",
        }))
    _schedule_notice(me.user_id, "Your branch link was approved",
                     f"{me.name} is now shown to customers as a branch of {biz.name}.")
    return biz


async def reject_request(db: AsyncSession, request_id: str, admin_user_id: str, reason: str) -> BusinessLinkRequest:
    reason = (reason or "").strip()
    if len(reason) < 3:
        raise ValidationException("Give a reason the vendor will see.")
    r = await _get_pending(db, request_id)
    me = await _vendor(db, r.vendor_id)
    r.status = "rejected"
    r.reason = reason[:500]
    r.reviewed_by = uuid.UUID(admin_user_id)
    r.reviewed_at = datetime.now(UTC)
    db.add(Notification(user_id=me.user_id, type="branch_decision", channel="in_app", sent_at=datetime.now(UTC), content={
        "title": "Branch link not approved", "body": reason,
    }))
    _schedule_notice(me.user_id, "Your branch link was not approved", reason)
    return r


def _schedule_notice(user_id: uuid.UUID, title: str, body: str) -> None:
    try:
        from workers.tasks.notifications import notify_user_notice

        notify_user_notice.apply_async(args=[str(user_id), title, body], countdown=3)
    except Exception:  # noqa: BLE001 - the in-app row is saved; push/email is best effort
        pass


async def admin_set_business(db: AsyncSession, vendor_id: str, business_id: str | None, name: str | None) -> Business:
    """Put a vendor into an existing business, or start a new one from it (admin tidy-up)."""
    vendor = await _vendor(db, vendor_id)
    if vendor.business_id:
        raise ValidationException("This vendor is already in a business. Unlink it first.")
    if business_id:
        biz = (await db.execute(select(Business).where(Business.id == uuid.UUID(business_id)))).scalar_one_or_none()
        if not biz:
            raise NotFoundException("Business not found")
    else:
        nm = (name or vendor.name).strip()
        biz = Business(name=nm, slug=await _unique_slug(db, nm))
        db.add(biz)
        await db.flush()
    vendor.business_id = biz.id
    await db.flush()
    return biz


async def admin_unlink(db: AsyncSession, vendor_id: str) -> None:
    vendor = await _vendor(db, vendor_id)
    if not vendor.business_id:
        raise ValidationException("This vendor is not in a business.")
    biz_id = vendor.business_id
    vendor.business_id = None
    await db.flush()
    await _drop_if_empty(db, biz_id)


async def admin_rename(db: AsyncSession, business_id: str, name: str) -> Business:
    name = (name or "").strip()
    if not 2 <= len(name) <= 255:
        raise ValidationException("A business name needs 2 to 255 characters.")
    biz = (await db.execute(select(Business).where(Business.id == uuid.UUID(business_id)))).scalar_one_or_none()
    if not biz:
        raise NotFoundException("Business not found")
    biz.name = name
    await db.flush()
    return biz


async def search_businesses(db: AsyncSession, query: str | None) -> list[dict]:
    q = select(Business).order_by(Business.name).limit(100)
    if query and query.strip():
        q = q.where(Business.name.ilike(f"%{query.strip()}%"))
    out = []
    for b in (await db.execute(q)).scalars().all():
        branches = await branches_of(db, b.id)
        out.append({"id": str(b.id), "name": b.name, "slug": b.slug, "branch_count": len(branches),
                    "branches": [{"vendor_id": str(v.id), "name": v.name, "place": place_of(v)} for v in branches]})
    return out


