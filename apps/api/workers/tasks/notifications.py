"""Notification dispatch tasks."""
from __future__ import annotations

import asyncio

from workers.celery_app import celery_app

# ── Notification triggers: (from_state, to_state) → [{recipient, title, body}] ──
# recipient: "customer" | "vendor"
_TRIGGERS: dict[tuple[str | None, str], list[dict]] = {
    (None, "PENDING"): [
        {"recipient": "vendor", "title": "New Order", "body": "You have a new order waiting for your review"},
    ],
    ("PAID", "VENDOR_ACCEPTED"): [
        {"recipient": "customer", "title": "Order Accepted", "body": "Your order has been accepted and is being prepared"},
    ],
    ("PAID", "VENDOR_REJECTED"): [
        {"recipient": "customer", "title": "Order Rejected", "body": "Unfortunately your order was rejected by the vendor"},
    ],
    ("PENDING", "CANCELLED"): [
        {"recipient": "vendor", "title": "Order Cancelled", "body": "An order has been cancelled by the customer"},
    ],
    ("READY_FOR_PICKUP", "PICKED_UP"): [
        {"recipient": "customer", "title": "Rider Assigned", "body": "A rider has picked up your order and is on the way"},
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
def send_otp_email_task(email: str, name: str, otp: str) -> None:
    from services.notification.emails import build_otp_email, send_email_via_resend
    subject = "Verify your AVDAN Account"
    html = build_otp_email(name, otp)
    send_email_via_resend(email, subject, html)


@celery_app.task(name="workers.tasks.notifications.send_order_notification")
def send_order_notification(order_id: str, from_state: str | None, to_state: str) -> None:
    triggers = _TRIGGERS.get((from_state, to_state), [])
    if not triggers:
        return
    asyncio.run(_dispatch_async(order_id, from_state, to_state, triggers))


@celery_app.task(name="workers.tasks.notifications.notify_rider_assigned")
def notify_rider_assigned(order_id: str, rider_user_id: str) -> None:
    """Separate from send_order_notification: assigning a rider is not an order state
    transition (the order stays READY_FOR_PICKUP until the rider confirms pickup — see
    DispatchService.assign_rider), so it never runs through the (from_state, to_state)
    trigger map above. The rider is also the recipient here, not customer/vendor."""
    asyncio.run(_notify_rider_assigned_async(order_id, rider_user_id))


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
            fcm_token = await _get_fcm_token(db, uuid.UUID(rider_user_id))
            if fcm_token:
                db.add(Notification(
                    user_id=uuid.UUID(rider_user_id),
                    type="rider_assigned",
                    channel="push",
                    content=content,
                    sent_at=now if await _send_fcm(fcm_token, title, body, content) else None,
                ))


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
                email = recipient_info["email"]
                name = recipient_info["name"]

                content = {
                    "title": trigger["title"],
                    "body": trigger["body"],
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
                        send_email_via_resend,
                    )
                    subject = f"AVDAN Order Update: {trigger['title']}"
                    html = build_order_status_email(name, order_id, trigger["title"], trigger["body"])
                    db.add(Notification(
                        user_id=user_id,
                        type=to_state.lower(),
                        channel="email",
                        content=content,
                        sent_at=now if send_email_via_resend(email, subject, html) else None,
                    ))

                # Attempt FCM push
                fcm_token = await _get_fcm_token(db, user_id)
                if fcm_token:
                    db.add(Notification(
                        user_id=user_id,
                        type=to_state.lower(),
                        channel="push",
                        content=content,
                        sent_at=now if await _send_fcm(fcm_token, trigger["title"], trigger["body"], content) else None,
                    ))


async def _resolve_recipients(db, order) -> dict[str, dict]:
    """Returns {"customer": {"id": UUID, "name": str, "email": str}, "vendor": ...}."""
    from sqlalchemy import select

    from services.auth.models import User
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

    return recipient_map


async def _get_fcm_token(db, user_id) -> str | None:
    from sqlalchemy import select

    from services.auth.models import User
    result = await db.execute(select(User.fcm_token).where(User.id == user_id))
    return result.scalar_one_or_none()


async def _send_fcm(token: str, title: str, body: str, data: dict) -> bool:
    """Sends a push notification via FCM Legacy API. Returns True on success."""
    from core.config import settings
    if not settings.fcm_server_key:
        return False

    import httpx
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://fcm.googleapis.com/fcm/send",
                headers={
                    "Authorization": f"key={settings.fcm_server_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "to": token,
                    "notification": {"title": title, "body": body},
                    "data": {k: str(v) for k, v in data.items()},
                },
                timeout=10,
            )
        return response.status_code == 200
    except Exception:
        return False
