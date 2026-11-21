"""The conversation between AVDAN staff and a vendor (see VendorMessage)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ValidationException
from services.auth.models import User
from services.notification.models import Notification
from services.vendor.models import Vendor, VendorMessage

MAX_LEN = 2000
_THREAD_LIMIT = 500


async def list_thread(db: AsyncSession, vendor_id: uuid.UUID, reader: str) -> list[VendorMessage]:
    """The whole thread, oldest first. Opening it marks the *other* side's messages as read."""
    rows = list((await db.execute(
        select(VendorMessage)
        .where(VendorMessage.vendor_id == vendor_id)
        .order_by(VendorMessage.created_at.desc())
        .limit(_THREAD_LIMIT)
    )).scalars().all())
    rows.reverse()
    await db.execute(
        update(VendorMessage)
        .where(
            VendorMessage.vendor_id == vendor_id,
            VendorMessage.sender_role != reader,
            VendorMessage.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    return rows


async def unread_count(db: AsyncSession, vendor_id: uuid.UUID, reader: str) -> int:
    from sqlalchemy import func

    return (await db.execute(
        select(func.count()).select_from(VendorMessage).where(
            VendorMessage.vendor_id == vendor_id,
            VendorMessage.sender_role != reader,
            VendorMessage.read_at.is_(None),
        )
    )).scalar_one()


def _snippet(text: str, n: int = 140) -> str:
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1] + "…"


async def post_message(
    db: AsyncSession, vendor: Vendor, sender_role: str, sender_id: str, body: str
) -> VendorMessage:
    """Add a message and tell the other side: the vendor when staff write, every active admin and
    support user when the vendor replies. Staff-to-vendor messages also go out by push and email
    (see notify_vendor_message) so a vendor who isn't looking at the app still finds out."""
    text = (body or "").strip()
    if not text:
        raise ValidationException("Write a message first.")
    if len(text) > MAX_LEN:
        raise ValidationException(f"Messages can be at most {MAX_LEN} characters.")
    if sender_role not in ("admin", "vendor"):
        raise ValidationException("Unknown sender.")

    msg = VendorMessage(
        vendor_id=vendor.id, sender_role=sender_role, sender_id=uuid.UUID(sender_id), body=text
    )
    db.add(msg)
    await db.flush()

    now = datetime.now(UTC)
    if sender_role == "admin":
        db.add(Notification(
            user_id=vendor.user_id, type="vendor_message", channel="in_app", sent_at=now,
            content={"title": "Message from AVDAN", "body": _snippet(text), "vendor_id": str(vendor.id)},
        ))
        try:
            from workers.tasks.notifications import notify_vendor_message

            notify_vendor_message.apply_async(args=[str(vendor.user_id), text], countdown=3)
        except Exception:  # noqa: BLE001 - the in-app message is saved; push/email is best effort
            pass
    else:
        admins = (await db.execute(
            select(User.id).where(User.role.in_(["admin", "support"]), User.status == "active")
        )).scalars().all()
        for admin_id in admins:
            db.add(Notification(
                user_id=admin_id, type="vendor_message", channel="in_app", sent_at=now,
                content={
                    "title": f"{vendor.name} replied",
                    "body": _snippet(text),
                    "vendor_id": str(vendor.id),
                },
            ))
    return msg
