"""Payment service — escrow logic, payment initiation, refunds."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.exceptions import AppError, ForbiddenException, NotFoundException, ValidationException
from services.orders.models import Order
from services.orders.service import OrderService
from services.orders.state_machine import OrderStatus
from services.payment.models import EscrowStatus, EscrowTransaction
from services.payment.providers.registry import get_provider


class PaymentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def initiate_payment(
        self, order_id: str, customer_id: str, is_mobile: bool = False
    ) -> tuple[str, str, str]:
        """Returns (payment_url, reference, escrow_id)."""
        order = await self._get_order(order_id)

        if str(order.customer_id) != customer_id:
            raise ForbiddenException("Access denied")
        if order.status != OrderStatus.PENDING:
            raise AppError(400, "INVALID_STATE", "Order must be PENDING to initiate payment")

        # Prevent double-initiation
        existing = await self._get_escrow_for_order(order_id)
        if existing and existing.status in (EscrowStatus.HELD, EscrowStatus.RELEASED):
            raise AppError(400, "ALREADY_PAID", "Order has already been paid")

        # Get customer email for Paystack
        from services.auth.models import User
        user_result = await self.db.execute(
            select(User).where(User.id == order.customer_id)
        )
        user = user_result.scalar_one_or_none()
        if not user or not user.email:
            raise ValidationException("Customer email required for payment")

        provider = get_provider("paystack")
        # Mobile gets a deep link so the OS hands control back to the app when checkout finishes.
        # Web keeps an https URL — a custom scheme means nothing in a browser tab.
        callback_url = (
            settings.payment_callback_url_mobile if is_mobile else settings.payment_callback_url
        )
        charge = await provider.initiate_charge(
            order_id, order.total_kobo, user.email, callback_url
        )

        escrow = EscrowTransaction(
            order_id=uuid.UUID(order_id),
            provider="paystack",
            provider_ref=charge.reference,
            amount_kobo=order.total_kobo,
            status=EscrowStatus.INITIATED,
            provider_metadata={"payment_url": charge.payment_url},
        )
        self.db.add(escrow)
        await self.db.flush()
        return charge.payment_url, charge.reference, str(escrow.id)

    async def handle_charge_success(
        self, provider_ref: str, raw_data: dict
    ) -> None:
        """Idempotent — safe to call multiple times with same reference."""
        escrow = await self._get_escrow_by_ref("paystack", provider_ref)
        if not escrow:
            return  # unknown reference, ignore silently

        if escrow.status == EscrowStatus.HELD:
            return  # already processed

        escrow.status = EscrowStatus.HELD
        escrow.provider_metadata = {**(escrow.provider_metadata or {}), **raw_data}

        order_svc = OrderService(self.db)
        await order_svc.transition(
            order_id=str(escrow.order_id),
            to_state=OrderStatus.PAID,
            actor_id=None,
            actor_role="system",
            metadata={"provider": "paystack", "provider_ref": provider_ref},
        )

    async def verify_and_apply(self, reference: str, customer_id: str | None = None) -> dict:
        """
        Ask Paystack directly whether a reference was paid, and apply the same transition the
        webhook would.

        This exists because `PENDING -> PAID` previously had exactly one path: the webhook. That
        made the mobile checkout fragile (the app had no way to know payment succeeded when it
        came back from the browser) and made local development impossible without a public
        tunnel. The webhook remains the source of truth and the retry safety net; this is the
        client-driven confirmation that runs the moment the user returns.

        Idempotent: it delegates to `handle_charge_success`, which no-ops once escrow is HELD.
        """
        escrow = await self._get_escrow_by_ref("paystack", reference)
        if not escrow:
            raise NotFoundException("Unknown payment reference")

        order = await self._get_order(str(escrow.order_id))

        # A customer may only verify their own order. Called without a customer_id (server-side)
        # the check is skipped.
        if customer_id is not None and str(order.customer_id) != customer_id:
            raise ForbiddenException("Access denied")

        # Already applied — report the settled state without calling Paystack again.
        if escrow.status in (EscrowStatus.HELD, EscrowStatus.RELEASED):
            return {"paid": True, "status": order.status, "order_id": str(order.id)}

        provider = get_provider("paystack")
        result = await provider.verify_payment(reference)

        if not result.paid:
            return {"paid": False, "status": order.status, "order_id": str(order.id)}

        # Guard against a mismatched amount before crediting the order. Paystack returns the
        # amount actually charged; if it does not match what we recorded, something is wrong and
        # a human should look rather than the order silently becoming PAID.
        if result.amount_kobo != escrow.amount_kobo:
            raise AppError(
                409,
                "AMOUNT_MISMATCH",
                "Paid amount does not match the order total. Contact support.",
            )

        await self.handle_charge_success(reference, result.raw_data)
        refreshed = await self._get_order(str(escrow.order_id))
        return {"paid": True, "status": refreshed.status, "order_id": str(refreshed.id)}

    async def get_escrow_for_order(
        self, order_id: str, requesting_user_id: str, requesting_role: str
    ) -> EscrowTransaction:
        order = await self._get_order(order_id)

        # Customers may only see their own orders' escrow
        if requesting_role == "customer" and str(order.customer_id) != requesting_user_id:
            raise ForbiddenException("Access denied")

        escrow = await self._get_escrow_for_order(order_id)
        if not escrow:
            raise NotFoundException("No escrow record found for this order")
        return escrow

    async def release_escrow(self, order_id: str) -> None:
        """
        Queue the vendor payout and deduct commission. Idempotent — safe to call or retry at any
        point, including while a transfer is already in flight.

        Paystack transfers are asynchronous: a "pending" result here only means the transfer was
        queued, not that the vendor was paid. The order only advances to
        PAYMENT_RELEASED -> COMPLETED once the `transfer.success` webhook confirms it (see
        `handle_transfer_webhook` below) — a `transfer.failed`/`transfer.reversed` webhook instead
        marks the escrow FAILED so it shows up for retry instead of silently paying nobody while
        the order still says COMPLETED. A "success" result (Paystack can return this
        synchronously for some transfer types) advances the order immediately, same as before.
        """
        escrow = await self._get_escrow_for_order(order_id)
        if not escrow:
            raise NotFoundException("No escrow found for order")

        if escrow.status in (EscrowStatus.RELEASED, EscrowStatus.PAYOUT_PENDING):
            return  # already released, or a transfer is already queued — idempotent

        if escrow.status != EscrowStatus.HELD:
            raise AppError(400, "INVALID_STATE", "Escrow must be HELD to release")

        order = await self._get_order(order_id)

        from services.vendor.models import Vendor
        vendor_result = await self.db.execute(
            select(Vendor).where(Vendor.id == order.vendor_id)
        )
        vendor = vendor_result.scalar_one_or_none()
        if not vendor or not vendor.paystack_recipient_code:
            raise AppError(
                422,
                "VENDOR_PAYOUT_NOT_CONFIGURED",
                "Vendor has not set up payout account",
            )

        commission = int(escrow.amount_kobo * settings.commission_rate_percent / 100)
        vendor_amount = escrow.amount_kobo - commission

        provider = get_provider(escrow.provider)
        transfer_ref = f"payout-{order_id}"
        result = await provider.transfer_to_vendor(
            vendor.paystack_recipient_code, vendor_amount, transfer_ref
        )

        if result.status == "otp":
            raise AppError(
                502,
                "TRANSFER_REQUIRES_OTP",
                "Paystack requested OTP confirmation for this transfer — disable Transfer OTP "
                "in Paystack Settings > Preferences before automated payouts can run.",
            )
        if result.status not in ("success", "pending"):
            raise AppError(
                502,
                "TRANSFER_FAILED",
                f"Transfer returned unexpected status '{result.status}'",
            )

        escrow.provider_metadata = {
            **(escrow.provider_metadata or {}),
            "transfer_ref": result.transfer_ref,
            "vendor_amount_kobo": vendor_amount,
            "commission_kobo": commission,
        }

        if result.status == "pending":
            escrow.status = EscrowStatus.PAYOUT_PENDING
            return  # handle_transfer_webhook finishes this once Paystack confirms

        escrow.status = EscrowStatus.RELEASED
        order_svc = OrderService(self.db)
        await order_svc.transition(
            order_id=order_id,
            to_state=OrderStatus.PAYMENT_RELEASED,
            actor_id=None,
            actor_role="system",
        )
        await order_svc.transition(
            order_id=order_id,
            to_state=OrderStatus.COMPLETED,
            actor_id=None,
            actor_role="system",
        )

    async def handle_transfer_webhook(self, event_type: str, reference: str) -> None:
        """
        The other half of `release_escrow`: applies Paystack's eventual confirmation of a queued
        transfer. `reference` is the `payout-{order_id}` string AVDAN sent when creating the
        transfer, which Paystack echoes back unchanged on every transfer webhook — that's enough
        to find the order without a separate lookup table.
        """
        if not reference.startswith("payout-"):
            return  # not a transfer AVDAN created

        order_id = reference.removeprefix("payout-")
        escrow = await self._get_escrow_for_order(order_id)
        if not escrow or escrow.status != EscrowStatus.PAYOUT_PENDING:
            return  # unknown order, or already resolved — idempotent no-op

        if event_type == "transfer.success":
            escrow.status = EscrowStatus.RELEASED
            order_svc = OrderService(self.db)
            await order_svc.transition(
                order_id=order_id,
                to_state=OrderStatus.PAYMENT_RELEASED,
                actor_id=None,
                actor_role="system",
            )
            await order_svc.transition(
                order_id=order_id,
                to_state=OrderStatus.COMPLETED,
                actor_id=None,
                actor_role="system",
            )
        else:  # transfer.failed, transfer.reversed
            escrow.status = EscrowStatus.FAILED

    async def process_refund(
        self, order_id: str, amount_kobo: int, admin_id: str, reason: str
    ) -> EscrowTransaction:
        escrow = await self._get_escrow_for_order(order_id)
        if not escrow:
            raise NotFoundException("No escrow found for order")

        if escrow.status not in (EscrowStatus.HELD, EscrowStatus.INITIATED):
            raise AppError(400, "INVALID_STATE", "Escrow is not in a refundable state")

        if amount_kobo > escrow.amount_kobo:
            raise ValidationException("Refund amount cannot exceed original payment amount")

        provider = get_provider(escrow.provider)
        result = await provider.refund(escrow.provider_ref, amount_kobo)

        escrow.status = EscrowStatus.REFUNDED
        escrow.provider_metadata = {
            **(escrow.provider_metadata or {}),
            "refund_ref": result.refund_ref,
            "refund_amount_kobo": amount_kobo,
            "refund_reason": reason,
        }

        order_svc = OrderService(self.db)
        await order_svc.transition(
            order_id=order_id,
            to_state=OrderStatus.REFUND_INITIATED,
            actor_id=admin_id,
            actor_role="admin",
            metadata={"reason": reason, "refund_amount_kobo": amount_kobo},
        )
        return escrow

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get_order(self, order_id: str) -> Order:
        result = await self.db.execute(
            select(Order).where(Order.id == uuid.UUID(order_id))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order not found")
        return order

    async def _get_escrow_for_order(self, order_id: str) -> EscrowTransaction | None:
        result = await self.db.execute(
            select(EscrowTransaction).where(
                EscrowTransaction.order_id == uuid.UUID(order_id)
            )
        )
        return result.scalar_one_or_none()

    async def _get_escrow_by_ref(
        self, provider: str, provider_ref: str
    ) -> EscrowTransaction | None:
        result = await self.db.execute(
            select(EscrowTransaction).where(
                EscrowTransaction.provider == provider,
                EscrowTransaction.provider_ref == provider_ref,
            )
        )
        return result.scalar_one_or_none()
