"""
Simulate a Paystack `charge.success` webhook against the local API.

Why this exists
---------------
`PENDING -> PAID` happens ONLY when Paystack calls `POST /payment/webhook/paystack`
(see `services/payment/webhook_router.py`). During local development Paystack cannot reach
your machine, so a checkout completed with a test card leaves the order stuck at PENDING and
the whole downstream lifecycle is untestable.

This script signs a payload with the same `PAYSTACK_SECRET_KEY` the API verifies against and
posts it to the real endpoint, so the genuine signature-verification path is exercised — it
does not bypass it. It only works against a local/staging API you control.

Usage
-----
    cd apps/api
    uv run python scripts/simulate_paystack_webhook.py <reference>          # by payment reference
    uv run python scripts/simulate_paystack_webhook.py --order <order_id>   # look the ref up

    # point at a non-default host
    uv run python scripts/simulate_paystack_webhook.py <reference> --api http://172.20.10.3:8000

The real alternative is an ngrok tunnel plus a webhook URL configured in the Paystack
dashboard; use that when you want to test Paystack's own retry behaviour.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import hmac
import json
import sys
import urllib.error
import urllib.request

sys.path.insert(0, ".")

from core.config import settings  # noqa: E402


DEFAULT_API = "http://localhost:8000"


async def reference_for_order(order_id: str) -> str | None:
    """Look up the escrow provider_ref recorded when payment was initiated."""
    from sqlalchemy import text

    from core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT provider_ref FROM escrow_transactions WHERE order_id = :oid"),
            {"oid": order_id},
        )
        row = result.first()
        return row[0] if row else None


def post_webhook(api: str, reference: str, amount_kobo: int) -> tuple[int, str]:
    body = {
        "event": "charge.success",
        "data": {
            "reference": reference,
            "status": "success",
            "amount": amount_kobo,
            "currency": "NGN",
            "channel": "card",
            "gateway_response": "Successful",
        },
    }
    raw = json.dumps(body).encode()

    # Paystack signs the raw request body with HMAC-SHA512 using the secret key.
    signature = hmac.new(
        settings.paystack_secret_key.encode(), raw, hashlib.sha512
    ).hexdigest()

    req = urllib.request.Request(
        f"{api.rstrip('/')}/payment/webhook/paystack",
        data=raw,
        headers={
            "Content-Type": "application/json",
            "x-paystack-signature": signature,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("reference", nargs="?", help="Paystack payment reference")
    p.add_argument("--order", help="Order id — the reference is looked up from escrow_transactions")
    p.add_argument("--amount", type=int, default=0, help="Amount in kobo (informational only)")
    p.add_argument("--api", default=DEFAULT_API, help=f"API base URL (default {DEFAULT_API})")
    args = p.parse_args()

    reference = args.reference
    if not reference and args.order:
        reference = asyncio.run(reference_for_order(args.order))
        if not reference:
            print(f"No escrow_transactions row found for order {args.order}.")
            print("Has the customer actually started checkout for it?")
            return 1
        print(f"Resolved reference for order {args.order}: {reference}")

    if not reference:
        p.error("give a reference, or --order <order_id>")

    status, text = post_webhook(args.api, reference, args.amount)
    print(f"POST /payment/webhook/paystack -> {status} {text}")
    if status == 200:
        print("Order should now be PAID. Check the vendor dashboard for the incoming order.")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
