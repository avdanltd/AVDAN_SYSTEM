"""Self-service account deletion (required by the Apple App Store and Google Play).

What happens: the person is anonymised, not erased. Their name, email, phone, push token,
notifications and (for vendors and riders) payout bank details are removed, the account can no
longer sign in, and a vendor's store is taken off the marketplace. Order, payment and wallet
records stay, because AVDAN must keep them for accounting, tax and dispute reasons; they no longer
point at a named person.

Deletion is refused while money or work is still in flight: an order that is paid-for and not yet
finished, a wallet that still holds money, or a withdrawal in progress. Nobody should lose money
or strand a customer by deleting.
"""
from __future__ import annotations

import secrets
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ValidationException
from core.security import hash_password, verify_password
from services.analytics.audit import record_audit
from services.auth.models import User
from services.notification.models import Notification
from services.orders.models import Order
from services.orders.state_machine import OrderStatus

# Roles that can delete themselves. Staff accounts (admin, support, hub agents) are managed by admins.
SELF_DELETE_ROLES = {"customer", "vendor", "rider"}

# An order is "finished" for deletion purposes in these states (or never paid, for PENDING).
_SETTLED = {
    OrderStatus.PENDING, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.VENDOR_REJECTED,
    OrderStatus.REFUND_INITIATED, OrderStatus.FAILED_DELIVERY, OrderStatus.PAYMENT_RELEASED,
    OrderStatus.DISPUTE_RESOLVED,
}


async def _open_orders(db: AsyncSession, column, owner_id: uuid.UUID) -> int:  # type: ignore[no-untyped-def]
    return int((await db.execute(
        select(func.count()).select_from(Order).where(column == owner_id, Order.status.notin_(_SETTLED))
    )).scalar_one())


async def delete_account(db: AsyncSession, user_id: str, password: str) -> None:
    from services.dispatch.models import Rider
    from services.vendor import business as biz
    from services.vendor.models import Vendor
    from services.wallet.models import WalletOwner
    from services.wallet.service import WalletService

    user = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)).with_for_update())).scalar_one_or_none()
    if not user or user.status == "deleted":
        raise ValidationException("This account no longer exists.")
    if user.role not in SELF_DELETE_ROLES:
        raise ValidationException("Staff accounts are removed by an AVDAN admin. Please contact support.")
    if not verify_password(password or "", user.password_hash):
        raise ValidationException("That password is not correct.")

    vendor = rider = None
    if user.role == "customer":
        if await _open_orders(db, Order.customer_id, user.id):
            raise ValidationException(
                "You have orders that are still in progress. Please wait until they are delivered or cancelled, then try again."
            )
    elif user.role == "vendor":
        vendor = (await db.execute(select(Vendor).where(Vendor.user_id == user.id))).scalar_one_or_none()
        if vendor:
            await _assert_nothing_in_flight(db, WalletService(db), WalletOwner.VENDOR, vendor.id, vendor.payout_account_number,
                                            await _open_orders(db, Order.vendor_id, vendor.id))
    elif user.role == "rider":
        rider = (await db.execute(select(Rider).where(Rider.user_id == user.id))).scalar_one_or_none()
        if rider:
            await _assert_nothing_in_flight(db, WalletService(db), WalletOwner.RIDER, rider.id, rider.payout_account_number,
                                            await _open_orders(db, Order.rider_id, rider.id))

    before = {"role": user.role, "status": user.status}

    # Remove what identifies the person.
    user.name = "Deleted user"
    user.email = f"deleted-{user.id}@deleted.invalid"
    user.phone = None
    user.password_hash = hash_password(secrets.token_urlsafe(32))  # nobody can sign in again
    user.fcm_token = None
    user.payout_pin_hash = None
    user.status = "deleted"
    await db.execute(delete(Notification).where(Notification.user_id == user.id))

    if vendor:
        if vendor.business_id:
            await biz.leave(db, vendor)
        vendor.status = "suspended"  # off the marketplace
        vendor.is_open = False
        vendor.paystack_recipient_code = vendor.payout_account_number = None
        vendor.payout_bank_name = vendor.payout_account_name = None
    if rider:
        rider.online = False
        rider.lat = rider.lng = None
        rider.paystack_recipient_code = rider.payout_account_number = None
        rider.payout_bank_name = rider.payout_account_name = None

    record_audit(db, user.id, "user.delete_account", "user", user.id, before, {"status": "deleted"})
    await db.flush()


async def _assert_nothing_in_flight(db, wallet, owner_type, owner_id, has_account, open_orders):  # type: ignore[no-untyped-def]
    if open_orders:
        raise ValidationException(
            "You still have orders in progress. Please finish or hand over those orders first, then try again."
        )
    s = await wallet.get_summary(owner_type, owner_id, has_account=bool(has_account))
    owed = s["available_kobo"] + s["ongoing_kobo"] + s["clearing_kobo"] + s["on_hold_kobo"] + s["requested_kobo"]
    if owed > 0:
        raise ValidationException(
            "Your wallet still holds money or a withdrawal is in progress. Withdraw your earnings and wait for pending "
            "payments to clear first, then try again."
        )
