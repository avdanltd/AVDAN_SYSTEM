# WALLET_PAYOUTS.md — how money reaches vendors and riders

Added 2026-10-28. Replaces the old "transfer to the vendor's bank the moment escrow releases"
flow. **Nothing is paid automatically anywhere.** Every naira leaves AVDAN only after the owner
requests it and an admin approves an amount.

## The money states (same words in every app)

| State | Vendor | Rider |
|---|---|---|
| **Ongoing** | Order paid, not yet delivered (net of commission, estimated) | Delivery fee on orders the rider is carrying |
| **Delivered / clearing** | Delivered, inside the `escrow_release_hours` dispute window | — (rider is credited on delivery) |
| **On hold** | Order under dispute | — |
| **Available** | Released: product total − commission. Withdrawable | Delivery fee, credited the moment the order is DELIVERED. Withdrawable |
| **Requested** | In a withdrawal request awaiting admin, or approved and in flight at the bank | same |
| **Paid out** | Admin approved and Paystack confirmed `transfer.success` | same |

`Available + Requested + Paid out = lifetime earned`, always — it is enforced by construction (below).

## How it is stored

- `wallet_entries` — append-only ledger (never updated/deleted, like `order_events`). Signed
  amounts relative to Available: `ORDER_CREDIT +`, `WITHDRAWAL_HOLD −`, `WITHDRAWAL_RELEASE +`
  (rejected, or approved for less), `WITHDRAWAL_REVERSAL +` (bank transfer failed). Balances are
  `SUM()`s, never stored counters, so they cannot drift from their history. A partial unique index
  makes crediting an order twice impossible.
- `payout_requests` — one row per withdrawal: requested / approved kobo, status, bank snapshot,
  who decided and when, note, Paystack transfer reference.
- `payout_request_events` — append-only audit trail per request (requested → approved/rejected →
  transfer success/failed), plus a row in the global `audit_log` for each admin decision.
- Orders gained `delivery_quote` (JSONB) — the breakdown behind `delivery_fee_kobo`.

## Lifecycle of one withdrawal

1. Owner requests ₦X (≥ `min_withdrawal_kobo`, ≤ Available, bank account saved). The owner row is
   locked `FOR UPDATE`, so two simultaneous requests cannot overdraw. ₦X moves Available → Requested.
2. Admin opens **Payouts** (web-admin), sees requester, amount, bank destination, wallet balances and the
   audit trail, then either:
   - **Approves an amount ≤ X** → difference (if any) returns to Available; `POST /transfer` is sent to
     Paystack with reference `wd-{request_id}`; status `PROCESSING` (or `PAID` if Paystack settles
     synchronously). If the Paystack call errors, nothing is committed and the request stays `REQUESTED`.
   - **Rejects with a reason** → full amount returns to Available; the reason is shown to the requester.
3. Paystack webhook `transfer.success` → `PAID`. `transfer.failed`/`transfer.reversed` → `FAILED` and
   the approved amount returns to Available. Webhooks are idempotent (duplicates are no-ops).

## When earnings are credited

- **Vendor:** `PaymentService.release_escrow` (Celery beat, after `escrow_release_hours` in
  `PAYMENT_RELEASE_PENDING`, or an admin dispute resolution) credits `total − commission` to the wallet
  and completes the order. The delivery fee is never part of the vendor's money. A dispute *split*
  credits the admin-chosen vendor amount (no commission) and refunds the customer's share.
- **Rider:** `DispatchService.deliver` credits the whole `delivery_fee_kobo` the instant the order is
  DELIVERED (no commission on it). Escrow release re-attempts it as an idempotent safety net.

## Delivery fee (what the rider is paid per order)

`fee = base_fee_kobo + per_km_kobo × total_km`, set once at checkout and stored with its breakdown.

- Route is **vendor → hub → customer**: every parcel goes through a hub for QA, so the rider drives
  both legs. `total_km = (vendor→hub + hub→customer) × road_factor` (straight-line haversine is
  multiplied by `road_factor`, default 1.3, because roads are not straight).
- The hub used is the one nearest the vendor with spare capacity (same rule dispatch uses), and
  dispatch later routes the order through that same hub — what the customer paid for is what is driven.
- Customer coordinates are captured at checkout (web: browser geolocation; mobile: `expo-location`)
  and a live quote is shown before the order is placed (`GET /orders/delivery-quote`).
- Fallbacks: no hub coordinates → vendor→customer directly; any missing coordinate → flat base fee.
- Defaults: base ₦500, ₦100/km, road factor 1.3, minimum withdrawal ₦1,000, release window 48h,
  commission 10%. All editable by an admin at **Config** and effective immediately. Example: vendor→hub
  8 km + hub→customer 12 km straight-line → 26 km road → ₦500 + 26 × ₦100 = **₦3,100**, all of it
  credited to the rider.

## Going live checklist

- [ ] Paystack: Transfers enabled (Registered Business) — **done by the team 2026-10-28**.
- [ ] Paystack Settings → Preferences: **Transfer OTP off**, otherwise approval returns `TRANSFER_REQUIRES_OTP`.
- [ ] Paystack webhook URL set to `https://api.avdanstore.com/payment/webhook/paystack` (handles `transfer.*`).
- [ ] Paystack balance funded enough to cover approved withdrawals (customer payments settle T+1).
- [ ] Migration `0018` runs automatically on deploy (`alembic upgrade head` is in the deploy workflows).
- [ ] Pre-wallet test rows: left untouched. `rider_payouts` is legacy and no longer written.
