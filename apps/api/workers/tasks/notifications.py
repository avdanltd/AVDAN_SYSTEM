"""Notification dispatch tasks."""
from __future__ import annotations

import asyncio

from workers import run_and_dispose
from workers.celery_app import celery_app

# ── Notification triggers: (from_state, to_state) → [{recipient, title, body}] ──
# recipient: "customer" | "vendor" | "rider"
_TRIGGERS: dict[tuple[str | None, str], list[dict]] = {
    # Order creation (None -> PENDING) is recorded directly by OrderService.create_order, never
    # through transition(), so it can't trigger anything — and an unpaid order isn't actionable
    # for the vendor anyway. PAID is the moment the vendor can (and must) accept it.
    ("PENDING", "PAID"): [
        {"recipient": "vendor", "title": "New Order", "body": "You have a new paid order waiting for your review"},
    ],
    ("PAID", "VENDOR_ACCEPTED"): [
        {"recipient": "customer", "title": "Order Accepted", "body": "Your order has been accepted and is being prepared"},
    ],
    ("PAID", "VENDOR_REJECTED"): [
        {"recipient": "customer", "title": "Order Rejected", "body": "Unfortunately your order was rejected by the vendor"},
    ],
    ("QA_IN_PROGRESS", "QA_FAILED"): [
        {"recipient": "vendor", "title": "QA Failed", "body": "Your order failed quality inspection at the hub and needs remediation"},
    ],
    ("PENDING", "CANCELLED"): [
        {"recipient": "vendor", "title": "Order Cancelled", "body": "An order has been cancelled by the customer"},
    ],
    ("READY_FOR_PICKUP", "PICKED_UP"): [
        {"recipient": "customer", "title": "Rider Assigned", "body": "A rider has picked up your order and is on the way"},
    ],
    ("QA_IN_PROGRESS", "QA_PASSED"): [
        {"recipient": "rider", "title": "Ready at Hub", "body": "Your parcel passed quality check — collect it from the hub for delivery"},
    ],
    ("QA_PASSED", "OUT_FOR_DELIVERY"): [
        {"recipient": "customer", "title": "Out for Delivery", "body": "Your order has passed quality check and is out for delivery!"},
    ],
    ("OUT_FOR_DELIVERY", "DELIVERED"): [
        {"recipient": "customer", "title": "Order Delivered", "body": "Your order has been delivered. Enjoy!"},
        {"recipient": "vendor", "title": "Order Delivered", "body": "Your order has been successfully delivered to the customer"},
    ],
    ("PAYMENT_RELEASED", "COMPLETED"): [
        {"recipient": "vendor", "title": "Payment Received", "body": "Your payment has been released to your account"},
    ],
    ("DELIVERED", "DISPUTED"): [
        {"recipient": "vendor", "title": "Dispute Raised", "body": "A dispute has been raised on one of your orders"},
    ],
}


@celery_app.task(name="workers.tasks.notifications.send_otp_email_task")
def send_otp_email_task(email: str, name: str, otp: str, role: str = "customer") -> None:
    from services.notification.emails import (
        build_otp_email,
        contact_email_for,
        send_email_via_resend,
    )
    subject = "Verify your AVDAN Account"
    html = build_otp_email(name, otp, role)
    send_email_via_resend(email, subject, html, reply_to=contact_email_for(role))


@celery_app.task(name="workers.tasks.notifications.send_invite_email_task")
def send_invite_email_task(email: str, name: str, role: str, link: str, valid_hours: int) -> None:
    from services.notification.emails import (
        build_invite_email,
        contact_email_for,
        send_email_via_resend,
    )
    html = build_invite_email(name, role, link, valid_hours)
    send_email_via_resend(
        email, "Welcome to AVDAN — set up your account", html, reply_to=contact_email_for(role)
    )


@celery_app.task(name="workers.tasks.notifications.send_password_reset_email_task")
def send_password_reset_email_task(
    email: str, name: str, link: str, valid_minutes: int, role: str = "customer"
) -> None:
    from services.notification.emails import (
        build_password_reset_email,
        contact_email_for,
        send_email_via_resend,
    )
    send_email_via_resend(
        email,
        "Reset your AVDAN password",
        build_password_reset_email(name, link, valid_minutes, role),
        reply_to=contact_email_for(role),
    )


@celery_app.task(name="workers.tasks.notifications.send_order_notification")
def send_order_notification(order_id: str, from_state: str | None, to_state: str) -> None:
    triggers = _TRIGGERS.get((from_state, to_state), [])
    if not triggers:
        return
    asyncio.run(run_and_dispose(_dispatch_async(order_id, from_state, to_state, triggers)))


@celery_app.task(name="workers.tasks.notifications.notify_admins_new_user")
def notify_admins_new_user(user_id: str) -> None:
    """In-app alert for every active admin and support user when someone joins: a customer or
    vendor who just signed up, or a staff member / rider / hub agent who accepted their invite."""
    asyncio.run(run_and_dispose(_notify_admins_new_user_async(user_id)))


_ROLE_LABELS = {
    "customer": "Customer", "vendor": "Vendor", "rider": "Rider", "agent": "Hub agent",
    "support": "Support", "admin": "Admin",
}


async def _notify_admins_new_user_async(user_id: str) -> None:
    from core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        async with db.begin():
            await create_new_user_alerts(db, user_id)


async def create_new_user_alerts(db, user_id: str) -> int:  # type: ignore[no-untyped-def]
    """Add the in-app "new user" row for each active admin / support user. Returns how many."""
    import uuid
    from datetime import UTC, datetime

    from sqlalchemy import select

    from services.auth.models import User
    from services.notification.models import Notification

    user = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalar_one_or_none()
    if not user:
        return 0
    label = _ROLE_LABELS.get(user.role, user.role.title())
    who = user.name or user.email or user.phone or "Someone"
    content = {
        "title": f"New {label.lower()} joined",
        "body": f"{who} just joined AVDAN as a {label.lower()}.",
        "user_id": user_id,
        "role": user.role,
    }
    admins = (await db.execute(
        select(User.id).where(User.role.in_(["admin", "support"]), User.status == "active")
    )).scalars().all()
    now = datetime.now(UTC)
    for admin_id in admins:
        db.add(Notification(user_id=admin_id, type="new_user", channel="in_app", content=content, sent_at=now))
    return len(admins)


@celery_app.task(name="workers.tasks.notifications.notify_vendor_message")
def notify_vendor_message(user_id: str, message: str) -> None:
    """Push + email to a vendor when AVDAN staff message them (the in-app row is already saved)."""
    asyncio.run(run_and_dispose(_notify_vendor_message_async(user_id, message)))


async def _notify_vendor_message_async(user_id: str, message: str) -> None:
    import uuid
    from datetime import UTC, datetime

    from sqlalchemy import select

    from core.database import AsyncSessionLocal
    from services.auth.models import User
    from services.notification.emails import (
        build_vendor_message_email,
        contact_email_for,
        send_email_via_resend,
    )

    async with AsyncSessionLocal() as db:
        async with db.begin():
            user = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalar_one_or_none()
            if not user:
                return
            now = datetime.now(UTC)
            snippet = " ".join(message.split())
            snippet = snippet if len(snippet) <= 140 else snippet[:139] + "…"
            await _push(db, user.id, "vendor_message", "Message from AVDAN", snippet,
                        {"title": "Message from AVDAN", "body": snippet}, now)
            if user.email:
                send_email_via_resend(
                    user.email, "A message from AVDAN about your store",
                    build_vendor_message_email(user.name or "", message),
                    reply_to=contact_email_for("vendor"),
                )


@celery_app.task(name="workers.tasks.notifications.notify_user_notice")
def notify_user_notice(user_id: str, title: str, body: str) -> None:
    """Push + email for a short notice to one user (the in-app row is already saved)."""
    asyncio.run(run_and_dispose(_notify_user_notice_async(user_id, title, body)))


async def _notify_user_notice_async(user_id: str, title: str, body: str) -> None:
    import uuid
    from datetime import UTC, datetime

    from sqlalchemy import select

    from core.database import AsyncSessionLocal
    from services.auth.models import User
    from services.notification.emails import (
        build_notice_email,
        contact_email_for,
        send_email_via_resend,
    )

    async with AsyncSessionLocal() as db:
        async with db.begin():
            user = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalar_one_or_none()
            if not user:
                return
            now = datetime.now(UTC)
            short = " ".join(body.split())
            short = short if len(short) <= 140 else short[:139] + "…"
            await _push(db, user.id, "notice", title, short, {"title": title, "body": short}, now)
            if user.email:
                send_email_via_resend(
                    user.email, title, build_notice_email(user.name or "", title, body, user.role),
                    reply_to=contact_email_for(user.role),
                )


@celery_app.task(name="workers.tasks.notifications.notify_rider_assigned")
def notify_rider_assigned(order_id: str, rider_user_id: str) -> None:
    """Separate from send_order_notification: assigning a rider is not an order state
    transition (the order stays READY_FOR_PICKUP until the rider confirms pickup — see
    DispatchService.assign_rider), so it never runs through the (from_state, to_state)
    trigger map above. The rider is also the recipient here, not customer/vendor."""
    asyncio.run(run_and_dispose(_notify_rider_assigned_async(order_id, rider_user_id)))


async def _notify_rider_assigned_async(order_id: str, rider_user_id: str) -> None:
    import uuid
    from datetime import UTC, datetime

    from core.database import AsyncSessionLocal
    from services.notification.models import Notification

    title = "New Delivery Assigned"
    body = "You've been assigned a new order — open the app to see pickup details."
    content = {"title": title, "body": body, "order_id": order_id}

    async with AsyncSessionLocal() as db:
        async with db.begin():
            now = datetime.now(UTC)
            db.add(Notification(
                user_id=uuid.UUID(rider_user_id),
                type="rider_assigned",
                channel="in_app",
                content=content,
                sent_at=now,
            ))
            await _push(db, uuid.UUID(rider_user_id), "rider_assigned", title, body, content, now)


# ── Legacy task signature kept for backwards compatibility ────────────────────
@celery_app.task(name="workers.tasks.notifications.send_notification")
def send_notification(user_id: str, notification_type: str, payload: dict) -> None:  # type: ignore[type-arg]
    pass  # Superseded by send_order_notification


# ── Async implementation ──────────────────────────────────────────────────────

async def _dispatch_async(
    order_id: str,
    from_state: str | None,
    to_state: str,
    triggers: list[dict],
) -> None:
    import uuid
    from datetime import UTC, datetime

    from sqlalchemy import select

    from core.database import AsyncSessionLocal
    from services.notification.models import Notification
    from services.orders.models import Order

    async with AsyncSessionLocal() as db:
        async with db.begin():
            result = await db.execute(
                select(Order).where(Order.id == uuid.UUID(order_id))
            )
            order = result.scalar_one_or_none()
            if not order:
                return

            # Resolve recipient user info (id, name, email)
            recipient_map = await _resolve_recipients(db, order)
            now = datetime.now(UTC)

            for trigger in triggers:
                role = trigger["recipient"]
                recipient_info = recipient_map.get(role)
                if not recipient_info:
                    continue
                user_id = recipient_info["id"]
                email = recipient_info.get("email")
                name = recipient_info["name"]

                body = trigger["body"]
                if to_state == "OUT_FOR_DELIVERY" and role == "customer" and order.delivery_code:
                    body = (
                        f"{body} Your delivery code is {order.delivery_code} — give it to the "
                        "rider only when you have received your order."
                    )
                trigger = {**trigger, "body": body}
                content = {
                    "title": trigger["title"],
                    "body": body,
                    "order_id": order_id,
                    "from_state": from_state,
                    "to_state": to_state,
                }

                # Create in-app notification
                db.add(Notification(
                    user_id=user_id,
                    type=to_state.lower(),
                    channel="in_app",
                    content=content,
                    sent_at=now,
                ))

                # Attempt Email Dispatch via Resend
                if email:
                    from services.notification.emails import (
                        build_order_status_email,
                        contact_email_for,
                        send_email_via_resend,
                    )
                    subject = f"AVDAN Order Update: {trigger['title']}"
                    html = build_order_status_email(name, order_id, trigger["title"], trigger["body"], role)
                    db.add(Notification(
                        user_id=user_id,
                        type=to_state.lower(),
                        channel="email",
                        content=content,
                        sent_at=now if send_email_via_resend(
                            email, subject, html, reply_to=contact_email_for(role)
                        ) else None,
                    ))

                await _push(db, user_id, to_state.lower(), trigger["title"], trigger["body"], content, now)


async def _resolve_recipients(db, order) -> dict[str, dict]:
    """Returns {"customer": {"id": UUID, "name": str, "email": str}, "vendor": ..., "rider": ...}.

    The rider gets push + in-app only (no "email" key) — delivery prompts are time-critical and
    an email for every hub pickup would be noise."""
    from sqlalchemy import select

    from services.auth.models import User
    from services.dispatch.models import Rider
    from services.vendor.models import Vendor

    recipient_map = {}

    # Customer
    cust_res = await db.execute(select(User).where(User.id == order.customer_id))
    customer = cust_res.scalar_one_or_none()
    if customer:
        recipient_map["customer"] = {
            "id": customer.id,
            "name": customer.name,
            "email": customer.email,
        }

    # Vendor
    vendor_result = await db.execute(select(Vendor).where(Vendor.id == order.vendor_id))
    vendor = vendor_result.scalar_one_or_none()
    if vendor:
        v_user_res = await db.execute(select(User).where(User.id == vendor.user_id))
        vendor_user = v_user_res.scalar_one_or_none()
        if vendor_user:
            recipient_map["vendor"] = {
                "id": vendor_user.id,
                "name": vendor_user.name,
                "email": vendor_user.email,
            }

    # Rider
    if order.rider_id:
        rider_res = await db.execute(select(Rider.user_id).where(Rider.id == order.rider_id))
        rider_user_id = rider_res.scalar_one_or_none()
        if rider_user_id:
            recipient_map["rider"] = {"id": rider_user_id, "name": "", "email": None}

    return recipient_map


_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def _push(db, user_id, notif_type: str, title: str, body: str, content: dict, now) -> None:
    """Send a push to the user's registered device (if any) and record it as a `push` row.

    The token is an Expo push token (`ExponentPushToken[...]`) registered by the mobile apps via
    PATCH /auth/me/push-token — stored in the `users.fcm_token` column, named for the original
    FCM design. Expo's push service relays to FCM/APNs with the credentials uploaded to EAS, so
    the backend needs no Firebase key. A user with no token (web-only, or an app build without
    push configured) simply gets no push row.
    """
    from services.notification.models import Notification

    token = await _get_push_token(db, user_id)
    if not token:
        return
    delivered = await _send_expo_push(db, user_id, token, title, body, content)
    db.add(Notification(
        user_id=user_id,
        type=notif_type,
        channel="push",
        content=content,
        sent_at=now if delivered else None,
    ))


async def _get_push_token(db, user_id) -> str | None:
    from sqlalchemy import select

    from services.auth.models import User
    result = await db.execute(select(User.fcm_token).where(User.id == user_id))
    return result.scalar_one_or_none()


async def _send_expo_push(db, user_id, token: str, title: str, body: str, data: dict) -> bool:
    """Send one push via Expo's push API. Returns True if Expo accepted it.

    A `DeviceNotRegistered` error means the app was uninstalled or the token rotated — the
    token is cleared so we stop sending to it; the app re-registers on its next launch.
    """
    import logging

    import httpx
    from sqlalchemy import update

    from core.config import settings
    from services.auth.models import User

    log = logging.getLogger(__name__)
    if not token.startswith(("ExponentPushToken[", "ExpoPushToken[")):
        return False  # a pre-Expo FCM token from the old design — not deliverable here

    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if settings.expo_access_token:
        headers["Authorization"] = f"Bearer {settings.expo_access_token}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                _EXPO_PUSH_URL,
                headers=headers,
                json={
                    "to": token,
                    "title": title,
                    "body": body,
                    "data": data,
                    "sound": "default",
                    "priority": "high",
                    "channelId": "default",
                },
                timeout=10,
            )
        ticket = response.json().get("data", {})
    except Exception as exc:  # noqa: BLE001 — push is best-effort, never breaks the caller
        log.warning("Expo push to user %s failed: %s", user_id, exc)
        return False

    if ticket.get("status") == "ok":
        return True
    error = (ticket.get("details") or {}).get("error")
    log.warning("Expo push to user %s rejected: %s (%s)", user_id, ticket.get("message"), error)
    if error == "DeviceNotRegistered":
        await db.execute(update(User).where(User.id == user_id).values(fcm_token=None))
    return False
