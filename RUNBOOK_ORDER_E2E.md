# RUNBOOK — Fulfil one order end to end (local)

> Verified against the running stack on 2026-08-22.
> Every account password is `Avdan@2024`.

---

## 1. Sign-in map — who, where, which browser

**Read this first.** Auth is an httpOnly cookie named `avdan_token`, and **cookies ignore port
numbers**. `localhost:3000` and `localhost:3001` are the *same* cookie host, so signing in as the
vendor silently destroys your customer session. You cannot run this flow with five tabs in one
browser window.

Cookies *are* scoped by hostname, so `localhost`, `127.0.0.1` and `172.20.10.3` are three
independent sessions on the same machine. Combine those with one extra browser (or a second
profile) and you have everything you need.

| # | Role | Sign in as | URL to open | Session slot |
|---|------|-----------|-------------|--------------|
| 1 | **Customer** | `customer1@avdan.com` | http://localhost:3000 | Chrome — normal window |
| 2 | **Vendor** | `vendor1@avdan.com` | http://127.0.0.1:3001 | Chrome — same window is fine (different host) |
| 3 | **Admin** | `admin@avdan.com` | http://172.20.10.3:3002 | Chrome — same window is fine (different host) |
| 4 | **Hub agent** | `hub1@avdan.com` | http://localhost:3003 | **Different browser** (Safari/Firefox) or a Chrome incognito window |
| 5 | **Rider — iPhone** | `rider1@avdan.com` | Expo Go → `exp://172.20.10.3:8081` | the phone |
| 6 | **Rider — Android** | `rider2@avdan.com` | Expo Go → `exp://172.20.10.3:8081` | the phone |
| 7 | **Vendor — mobile** | `vendor1@avdan.com` | Expo Go → `exp://172.20.10.3:8082` | either phone |

`app-rider` serves on **8081**, `app-vendor` on **8082** — both can run at once. The vendor app
wears the inverted brand lockup (gold ground, navy arrow) so the two are easy to tell apart on a
home screen that has both.

Slots 1–3 use three different hostnames, so they hold three simultaneous logins in one browser.
Slot 4 reuses the `localhost` host that slot 1 already occupies, so it needs its own browser or an
incognito window.

> If a page bounces you back to `/login` unexpectedly, another role has taken that hostname's
> cookie. Move it to a spare browser rather than fighting it.

Other seeded accounts if you want them: `customer2..5`, `vendor2..8`, `rider3`, `rider4`,
`hub2@avdan.com`, `support@avdan.com`.

---

## 2. Bring the stack up

Postgres and Redis run under **DBngin** — Docker is not involved. The database is already migrated
(`alembic_version` = 0014) and seeded (21 users, 8 categories, 8 vendors, 78 products).

```bash
# API — must bind 0.0.0.0 so the phones can reach it
cd apps/api
uv run uvicorn main:app --host 0.0.0.0 --port 8000

# Web apps (each in its own terminal, from the repo root)
cd apps/web-customer && npx next dev     # :3000
cd apps/web-vendor   && npx next dev     # :3001
cd apps/web-admin    && npx next dev     # :3002
cd apps/web-hub      && npx next dev     # :3003

# Mobile apps (separate Metro ports so both can run together)
cd apps/app-rider  && npx expo start --clear                # :8081
cd apps/app-vendor && npx expo start --port 8082 --clear    # :8082
```

Health check: <http://172.20.10.3:8000/health> should return `{"status":"ok",...}`.
API docs: <http://172.20.10.3:8000/docs>

**The LAN IP matters.** The phones reach your Mac at `172.20.10.3`. If your network changes, that
address changes — update `apps/app-rider/.env.local` and restart Metro.

---

## 3. The order lifecycle — who does what

Nine hand-offs. Steps marked **SYSTEM** are not performed by a human.

### 1. Place the order — Customer (:3000)
Browse, add to cart, checkout. Paystack returns a real test-mode checkout URL.

`— → PENDING`

### 2. Confirm payment — SYSTEM (webhook)
Only Paystack's webhook marks an order paid, and **Paystack cannot reach your laptop**, so the
order will sit at `PENDING` forever on its own. Fire a correctly-signed webhook yourself:

```bash
cd apps/api
uv run python scripts/simulate_paystack_webhook.py --order <ORDER_ID>
```

This signs the payload with your real `PAYSTACK_SECRET_KEY` and goes through the genuine
signature-verification path — it does not bypass it. Get the order id from the customer's order
page or the admin Orders table.

`PENDING → PAID`

### 3. Accept and prepare — Vendor (127.0.0.1:3001, or the vendor mobile app)
The order appears in the incoming queue. **Two presses:** *Accept* advances two states in one
request (`PAID → VENDOR_ACCEPTED → PREPARING`, see `OrderService.accept_order`), then
*Mark ready* does the last hop. *Reject* instead sends it to `VENDOR_REJECTED` and queues a refund.

`PAID → VENDOR_ACCEPTED → PREPARING → READY_FOR_PICKUP`

### 4. Assign a rider — Admin (172.20.10.3:3002)
Open **Dispatch** and assign the order. Pick **rider1** for the iPhone leg, **rider2** for Android.

> **Changed 2026-08-22:** assigning no longer jumps the order to `PICKED_UP`. It used to
> auto-transition on the rider's behalf, recording a pickup that never physically happened and
> making the rider's own Confirm Pickup button unreachable. The order now correctly stays in
> `READY_FOR_PICKUP` until the rider confirms.

`READY_FOR_PICKUP → READY_FOR_PICKUP` (rider_id set)

### 5. Collect from the vendor — Rider (phone)
The order shows on Home as the active delivery. Tap **Confirm Pickup**, then
**Mark In Transit to Hub**.

`READY_FOR_PICKUP → PICKED_UP → IN_TRANSIT_TO_HUB`

### 6. Receive and inspect — Hub agent (:3003, separate browser)
Mark received at hub, start QA, pass it. Passing QA advances two states in one request, so the
order lands directly on out-for-delivery — riders never see a `QA_PASSED` order to act on.

`IN_TRANSIT_TO_HUB → AT_HUB → QA_IN_PROGRESS → QA_PASSED → OUT_FOR_DELIVERY`

### 7. Last mile — Rider (phone)
The order reappears in the active queue. Tap **Confirm Delivered**. It leaves the active list and
lands under the **History** tab.

`OUT_FOR_DELIVERY → DELIVERED`

### 8. Escrow hold begins — SYSTEM ✅ automatic
Marking the delivery done now starts the escrow hold in the same request. The rider's deliver
endpoint returns `PAYMENT_RELEASE_PENDING`, not `DELIVERED`.

The rider app deliberately shows all three post-delivery states as plain **"Delivered"** — escrow
bookkeeping means nothing to the person who dropped off the parcel.

`DELIVERED → PAYMENT_RELEASE_PENDING`

### 9. Release and complete — SYSTEM (Celery)
A Beat job every 15 minutes releases escrow for orders held longer than 48 hours, pays the vendor
minus commission, then completes the order. Two things gate it: Celery worker + Beat must be
running, and the vendor must have `paystack_recipient_code` set or release raises
`VENDOR_PAYOUT_NOT_CONFIGURED`. The 48-hour hold means this will not complete inside a test session
without shortening the cutoff.

```bash
cd apps/api
uv run celery -A workers.celery_app worker --loglevel=info
uv run celery -A workers.celery_app beat  --loglevel=info
```

`PAYMENT_RELEASE_PENDING → PAYMENT_RELEASED → COMPLETED`

---

## 4. What actually completes today

Steps **1 → 8** run end to end: checkout, payment, vendor fulfilment, dispatch, both rider legs,
hub QA, delivery, and the escrow hold starting automatically.

Step 9 needs Celery running and a 48-hour wait, so it is not part of a normal test session.

---

## 5. Pre-staged test data

Both riders already have orders assigned so you can test the rider legs without running steps 1–4
first:

| Rider | Status | Tests |
|-------|--------|-------|
| rider1 (iPhone) | `READY_FOR_PICKUP` | Confirm Pickup |
| rider1 | `IN_TRANSIT_TO_HUB` | hub receipt from :3003 |
| rider1 | `DELIVERED` | History tab |
| rider2 (Android) | `READY_FOR_PICKUP` | Confirm Pickup |
| rider2 | `PICKED_UP` | Mark In Transit |
| rider2 | `OUT_FOR_DELIVERY` | Confirm Delivered / Report Failed |

---

## 6. If something stalls

- **Signed out unexpectedly on a web app** — another role took that hostname's cookie. See §1;
  move that role to a different hostname or browser.
- **Phone can't reach the app** — check `apps/app-rider/.env.local` points at the current LAN IP,
  then restart Metro with `npx expo start --clear`.
- **Order won't leave `PENDING`** — run the webhook simulator in step 2. The real alternative is an
  ngrok tunnel with the URL registered in your Paystack dashboard.
- **Rider's Orders tab is empty** — confirm the order carries a `rider_id` for the signed-in rider
  and its status is one the rider still owns (`READY_FOR_PICKUP`, `PICKED_UP`,
  `IN_TRANSIT_TO_HUB`, `AT_HUB`, `QA_PASSED`, `OUT_FOR_DELIVERY`).
- **Login rejected on a web app** — each app's `JWT_SECRET` must equal the API's `SECRET_KEY`.
  All five currently match.
- **Stale screens after a code change** — `npx expo start --clear`.

### Useful queries

```bash
export PATH="/Users/Shared/DBngin/postgresql/16.2/bin:$PATH"

# What is assigned to whom
PGPASSWORD=avdan_dev psql -h localhost -U avdan -d avdan -c \
  "select u.email, o.id, o.status from orders o
     join riders r on r.id=o.rider_id
     join users u on u.id=r.user_id order by u.email;"

# Full history of one order
PGPASSWORD=avdan_dev psql -h localhost -U avdan -d avdan -c \
  "select from_state, to_state, actor_role, created_at
     from order_events where order_id='<ORDER_ID>' order by created_at;"
```
