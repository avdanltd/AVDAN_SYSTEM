# BACKLOG — Harmonisation, storage, payments

> Opened 2026-08-22 after `app-vendor` was built. Everything here was found by running the stack,
> not by reading it. Ordered by what blocks what, not by size.

---

## 0. Fixed already (2026-08-22)

- [x] **All vendor product writes returned HTTP 500.** `_product_response` (vendor/router.py)
      reads `product.category.name`, but `_get_product_for_user` never eager-loaded the
      relationship, so the async engine raised
      `greenlet_spawn has not been called; can't call await_only() here`.
      Broke **create, update and availability-toggle** — on web-vendor too, so vendor catalog
      management had never worked end to end. Fixed with `selectinload(Product.category)` plus a
      `_load_product_with_category` reload after create (a newly added instance has no
      relationship populated). Verified: create / toggle / update / delete all 2xx.

---

## 1. `@avdan/mobile` — stop duplicating the mobile UI  ✅ DONE 2026-08-22

**Why it mattered (kept for the record):** these files were copied byte-for-byte between
`app-rider` and `app-vendor`.
Extracting costs 2 app migrations today and 3 tomorrow, and every hour spent building
`app-customer` on copies raises the price. This is the same drift that already went wrong on the
web side (see the Design System Alignment initiative — "UI had drifted inconsistent across apps").

`packages/ui` cannot be reused: it is Tailwind + Shadcn, none of which runs in React Native. This
is a genuinely separate package, not a duplicate of one.

### What moved
| File | Notes |
|------|------------------|
| `constants/theme.ts` | Palettes, spacing, radius, fonts, elevation. **Per-app bits stay behind:** each app keeps its own status-label map (a rider says "Delivered", a vendor says "Payout pending" for the same state) and its own accent lockup. |
| `theme/theme-context.tsx` | Unchanged — `ThemeProvider` / `useTheme`. |
| `components/ui.tsx` | `Card`, `Button`, `Badge`, `Skeleton`, `EmptyState`, `BrandLoader`, `InfoRow`, `SectionTitle`. |
| `components/brand-logo.tsx` | `AvdanMark` / `AvdanLogo`. Takes a `variant` prop for the rider (blue/gold) vs vendor (gold/navy) lockup instead of being forked. |
| `lib/api-client.ts` | Needs a small injection point: it currently imports `expo-router`'s `router` to redirect on 401. Take an `onUnauthorized` callback so the package stays router-agnostic. |
| `lib/secure-storage.ts`, `lib/toast.ts`, `lib/toast-config.tsx`, `lib/format.ts` | As-is. |
| `modules/auth/*` | service, store, hooks, schemas. The login **form** stays per-app (different copy, different hero). |

### What was done
1. `packages/mobile/` created as `@avdan/mobile` — source-only (`"main": "src/index.ts"`), with a
   self-contained tsconfig so it type-checks standalone, and peer deps on expo/react-native so
   nothing is double-installed.
2. All 15 byte-identical files moved. `theme.ts` was the only file that differed between the two
   apps, and only in its status-label map — see the split below.
3. `api-client` decoupled: `configureApiClient({ baseUrl, onUnauthorized })` is called once from
   each app's root layout, so the package no longer imports `expo-router` or `expo-constants`.
4. Both apps migrated, all copies deleted, `tsc --noEmit` clean on package + both apps.
5. **No `metro.config.js` was needed** — Expo SDK 54's default config already resolves workspace
   symlinks (the same way `@avdan/types` always has).
6. Verified by building both iOS bundles through Metro and asserting on their contents:
   rider 14.3 MB with rider-only strings and no vendor strings, vendor 11.8 MB with vendor-only
   strings and no rider strings, both containing the shared package.

### What stayed per-app, and why
- **Status labels** (`src/constants/status.ts` in each app). The package exports a
  `createStatusLabel(overrides)` factory; each app passes its own map. The same state genuinely
  reads differently per role — `PAYMENT_RELEASE_PENDING` is "Delivered" to the rider who dropped
  the parcel off and "Payout pending" to the vendor waiting to be paid.
- **`statusColors`** moved to the package but was widened to cover the **full** state machine, not
  one role's subset — a shared package cannot know which statuses a given app will render.
- **The login form** — different copy and hero per app.

### Follow-up when `app-customer` lands
`AvdanMark` still hard-codes the rider lockup (blue ground, gold arrow). The vendor app uses the
inverted lockup only in its generated icon files, not in the in-app SVG. Give `AvdanMark` a
`variant` prop when a third app needs a third treatment.

---

## 2. Object storage on R2 — backend DONE 2026-08-22, apps outstanding

### Built and verified
- `services/storage/` — R2 client (`aioboto3`, SigV4, `region_name="auto"`). One bucket
  (`avdan-media`), split by prefix: `products/` and `vendor-logos/` public, `qa-evidence/` private.
- `POST /uploads/presign` — role-gated presigned PUT. The **server chooses the key**, so a client
  cannot overwrite another vendor's object by guessing a path. `content_length` is validated and
  pinned into the signature, so a client cannot declare 1 MB and then upload 500 MB.
- `GET /uploads/qa-evidence/{order_id}/{filename}` — role-checks (admin/support always; agent only
  for orders at their own hub), then 307s to a 5-minute presigned read.
- **QA evidence migrated off local disk.** `services/qa/router.py` now writes to R2 instead of
  `./media/qa-evidence/`, which did not survive a restart and broke with >1 API replica.
  web-hub's existing multipart call is unchanged — the endpoint kept its contract.
- `settings.storage_enabled` gates everything, so an unconfigured environment returns a clear
  503 rather than failing deep inside boto3.

Verified against the live bucket: presign → PUT (200) → fetch from `cdn.avdanstore.com`
(200, byte-identical). Authorisation matrix confirmed — rider→products 403, vendor→qa-evidence 403,
SVG rejected, 20 MB rejected, unauthenticated 401, hub1 307 / hub2 403 / admin 307 / customer 403.
All test objects were deleted afterwards.

### ✅ Cloudflare WAF rule — added and verified 2026-08-22

The CDN domain is bound to the whole bucket, so it originally served
`cdn.avdanstore.com/qa-evidence/...` to anyone holding a key, bypassing every role check in the
API. A WAF custom rule now blocks that prefix on the CDN hostname.

Verified against a **real uploaded object**, not just a synthetic path:

| Check | Result |
|-------|--------|
| `cdn.avdanstore.com/qa-evidence/<real key>` | **403**, no bytes leaked |
| `cdn.avdanstore.com/products/...`, `/vendor-logos/...` | 404 (reachable — rule is correctly scoped) |
| `GET /uploads/qa-evidence/...` as the owning agent | 307 → presigned |
| the presigned URL itself (R2 endpoint, not the CDN) | 200, correct bytes |

Re-run those four whenever the rule or the CDN binding changes. A rule that only blocks
non-existent paths would look identical to a working one if you test with a synthetic key.

### Cloudflare setup checklist
1. R2 bucket `avdan-media` — done.
2. Custom domain `cdn.avdanstore.com` bound to it — done.
3. API token scoped **to that bucket only**, Object Read & Write — done.
4. **WAF rule blocking `/qa-evidence/*` — NOT DONE, see above.**
5. **Bucket CORS — applied and verified 2026-08-22.** Needed only for presigned PUT from a
   *browser*; React Native's fetch is not subject to CORS, so both mobile apps work without it.
   The policy lives in `apps/api/scripts/configure_r2_cors.py` (20 origins, `PUT/GET/HEAD`,
   `content-type`, ETag exposed, no wildcard origin).

   Applied with a temporary **Admin Read & Write** token, which has since been reverted to
   Object Read & Write. Verified with a real preflight:
   allowed origin → `204` echoing that exact origin back; disallowed origin → `403`.

   **The running app never needs admin scope.** Only re-elevate to change this policy, and
   revert immediately after — `uv run python scripts/configure_r2_cors.py --apply`.

### Still outstanding
- [x] **`app-vendor` product images — done 2026-08-22.** `uploadImage()` in `@avdan/mobile`
      (presign → PUT → return CDN URL) plus `ImagePickerField` in the product form: multi-select up
      to 5, per-image remove, and promote-to-main. Only the first image carries meaning (it is what
      listings show), so promotion is offered instead of full drag-to-reorder.
      Verified in the built bundle: expo-image-picker, `/uploads/presign` and the picker UI all
      present; `tsc --noEmit` clean.
- [ ] Vendor logo upload (same flow, `vendor-logos/` prefix).
- [x] **Product images on ORDER LINES — done 2026-08-22, migration `0015`.**
      Added `order_items.product_image_url` as a **snapshot**, matching how `product_name` and
      `price_kobo` already work: captured at order creation so a later catalogue edit cannot
      rewrite what an existing order shows. A live join to `products` was rejected for exactly
      that reason. Backfilled all 30 existing rows from each product's current first image
      (best available approximation for pre-0015 orders).
      Populated in all four `OrderItemResponse` constructors (orders, dispatch, qa, admin) —
      grep for `OrderItemResponse(` before adding a fifth. Rendered as a thumbnail with a
      Package-icon fallback in both apps' order detail. `@avdan/types` regenerated.
- [ ] web-vendor image upload (needs the CORS policy applied — see checklist item 5).
- [ ] Orphaned-object cleanup. Removing an image from the form intentionally does **not** delete
      the R2 object, because the product save may still be cancelled. A periodic sweep for objects
      under `products/` that no product references would reclaim them.

---

## 3. Payments — backend DONE 2026-08-22, `app-customer` client outstanding

### Decided
No official Paystack React Native SDK exists. `react-native-paystack-webview` (a community WebView
wrapper) was rejected: it is the "web mixed into mobile" outcome to avoid, and it puts card entry
inside a JS-controlled WebView.

**Use `expo-web-browser`'s `openAuthSessionAsync`.** It opens checkout in the OS's own hardened
browser (SFSafariViewController / Chrome Custom Tab) and returns to the app via deep link. This is
not an embedded web view — it is the same mechanism OAuth sign-in uses, it is what Apple and Google
expect, and card details never touch our JS.

### Built and verified
- **`POST /payment/verify/{reference}`** — asks Paystack directly and applies the same transition
  the webhook would. This is the piece that removes the redirect race: the app confirms payment the
  moment it returns from the browser rather than waiting for a webhook that may not have arrived.
  Customer-scoped (403 on someone else's order, 404 on an unknown reference), and it refuses to
  credit an order whose paid amount does not match the escrow amount (409 `AMOUNT_MISMATCH`).
- **Per-platform callback.** `POST /payment/initiate/{order_id}` reads `X-Client-Platform` — the
  same header the auth contract already uses — and hands Paystack the deep link
  (`payment_callback_url_mobile`) for mobile, the https URL for web. A custom scheme means nothing
  in a browser tab, and an https URL cannot hand control back to an app.
- **Idempotency proven**, which is the whole point of having two paths: webhook first, then two
  verify calls, produced exactly **one** `PENDING → PAID` event. Whichever arrives first wins; the
  rest are no-ops via `handle_charge_success`.
- **`scripts/tunnel_webhook.sh`** — cloudflared quick tunnel so Paystack can reach localhost.
  Verify-on-return covers the happy path, but only a real webhook exercises signature verification,
  Paystack's retries, and the case where the customer closes the app mid-payment and the webhook is
  the *only* thing that ever arrives. Needs `brew install cloudflared`, then paste the printed
  hostname into Paystack → Settings → API Keys & Webhooks as the test webhook URL.

### `app-customer` client — DONE 2026-08-23
Built third, after the harmonisation work it depends on (`@avdan/mobile`, R2 images, the verify
endpoint) was already in place — see `STATUS_FRONTEND.md` Phase 10 for the full breakdown.

- [x] `scheme: 'avdancustomer'`, route `app/checkout/callback.tsx` (outside the tab group — a
      safety net for the OEM-browser edge case where the deep link opens a cold start instead of
      resolving the open `openAuthSessionAsync` session).
- [x] Checkout calls `openAuthSessionAsync`, then `POST /payment/verify/{reference}` on return.
- [x] Dismissed case handled: `openAuthSessionAsync` resolving `dismiss` still triggers verify,
      since swiping the browser away does not mean the payment did not go through.
- [x] **Caught before shipping:** `expo-web-browser` was briefly listed in `app.config.ts`'s
      `plugins` array. It ships no config plugin, so this would have failed `expo prebuild`/EAS
      with "does not contain a valid config plugin". Removed; rebuilt bundle confirmed identical.
- [x] Cart is grouped by vendor (`groupByVendor` in `cart.store.ts`) because `POST /orders` takes a
      single `vendor_id` — a basket spanning sellers is genuinely several checkouts, shown as such
      rather than discovered as a failure at the API.
- [x] Verified: full order-create → list → detail round trip against the live API, including the
      migration-0015 image snapshot rendering on order lines. `tsc --noEmit` clean; iOS bundle
      builds (11.9 MB) with zero cross-app string leakage against the rider/vendor bundles.

---

## 4. Vendor payout account — DONE 2026-08-22

Built into `app-vendor` at `/profile/payout`, replacing the card that used to point at the web
dashboard. There was never a good reason for it to live on web; it was simply not built yet.

**Verify-before-save**: pick bank → type the 10-digit account number → resolve it to the real
account name through Paystack → only then is it saved. Mistyping a digit is easy and the
consequence — money reaching a stranger — is not recoverable, so the confirmation is the point of
the screen rather than friction. Changing either input clears a previously resolved name, so a
vendor cannot confirm one account and save a different number.

An unset payout account is surfaced as a tappable warning on Profile, not buried in settings,
because `release_escrow` raises `VENDOR_PAYOUT_NOT_CONFIGURED` without one — **none of the 8 seeded
vendors has one, so escrow release currently fails for everybody.**

---

## 5. Hide unpaid orders from vendors — agreed, small

`GET /orders/vendor/incoming` returns `PENDING` (unpaid) orders. A vendor cannot act on one and
cannot influence it; showing it only invites "why can't I accept this?". The mobile app currently
files them under Active labelled "Awaiting payment", which is honest but still noise.

Filter `PENDING` out server-side in `OrderService.list_vendor_orders`, then drop the
special-casing from the app. Keep it visible in admin, which legitimately needs the full picture.

---

## 6. Three customer-app gaps — found and verified while explaining why they weren't built

Not vague "not built yet" notes — each was checked live against the running backend on
2026-08-23, so the fix is scoped, not guessed at.

- [ ] **No address book.** `PATCH /auth/me` (`UpdateProfileRequest`) only accepts `name` and
      `phone`. `delivery_address` exists only as a field on an order — there is no
      `addresses` table, no `POST /addresses`. Needs: an `addresses` table scoped to the
      customer, CRUD endpoints, and a "saved addresses" picker in checkout that still allows a
      one-off address. Not a mobile-app gap — nothing to build against yet.
- [ ] **Order tracking websocket (`WS /ws/order/{order_id}`) cannot be used from any mobile app.**
      It auths via `websocket.cookies.get("avdan_token")` only — no `Authorization` header or
      token-query-param fallback, unlike every REST endpoint (`get_current_user` already supports
      both). React Native does not carry cookies the way a browser tab does, so a mobile client is
      refused at the WebSocket handshake. Confirmed **not even `app-rider`** — the app broadcasting
      the location this socket streams — connects to it; it is exercised only by `web-customer`.
      Fix: accept a token via query param or a WS subprotocol header, same pattern `get_current_user`
      already uses for the Bearer fallback, then wire it into `app-customer`'s order detail screen.
- [ ] **Notification center would ship permanently empty.** `GET /notifications` works — tested
      live, returns the correct empty shape (`{"items": [], "total": 0, "unread_count": 0}`) — but
      grepping the whole backend for anywhere a `Notification` row is created returns **nothing**.
      No order-status hook, no producer, ever. Fix: hook `OrderService.transition` (or the
      individual transition call sites) to insert a notification row on the state changes a
      customer/vendor/rider actually cares about, before building a UI for it.

---

## 7. Escrow payout robustness — found while documenting the money model

See `docs/ESCROW_MODEL.md` for the full answer on subaccounts vs transfers vs wallet. Short
version: **transfers from balance is the only mechanism that can actually hold funds**, it is what
the code already does, and subaccounts would structurally break escrow because Paystack settles
them on its own cycle. A wallet/withdrawal layer is a worthwhile phase-2 addition on top, not an
alternative.

Concrete gaps that came out of writing that up:

- [ ] **A failed transfer leaves the vendor unpaid with the order marked COMPLETED.**
      `transfer_to_vendor` treats Paystack's `pending` as success, but transfers are asynchronous
      and can fail after being queued. There is no `transfer.failed` / `transfer.success` webhook
      handler. Needs: handle those events in `webhook_router.py`, and a payout status on the escrow
      row so a failure is visible and retryable instead of silent.
- [ ] **Transfer OTP is enabled by default on Paystack accounts**, which makes automated payouts
      impossible — the Celery task cannot answer an OTP prompt. Must be disabled before scheduled
      releases can work. Untested against a live transfer.
- [ ] **⛔ BLOCKER, VERIFIED 2026-08-22: the Paystack account is a *Starter business* and the
      Transfers API is switched off for it.** A live `POST /transfer` returns
      `"You cannot initiate third party payouts as a starter business"`. Until the business is
      upgraded to *Registered Business* (CAC documents, approved by Paystack) **no vendor can be
      paid by any route** — automatic release, manual release, or a future wallet withdrawal.
      Creating transfer recipients fails for the same reason, so `save_payout_account` cannot
      complete either. Start the upgrade now; it is not instant.
- [ ] **Test mode cannot exercise the payout screen.** Paystack test mode resolves only against
      bank code `001`, but `GET /bank` returns 278 live banks and `001` is not in that list, and
      live resolves are capped at 3/day in test mode. Options: inject a synthetic "Test Bank (001)"
      entry into the bank list when `PAYSTACK_SECRET_KEY` starts with `sk_test_`, or accept that
      this screen is only testable in live mode.
- [ ] Releasing escrow faster than Paystack's T+1 settlement can fail on insufficient balance. The
      48h hold covers this incidentally; a manual early release would not.

---

## 9. Production incident — api.avdanstore.com 502, then found the DB was down too (2026-09-01)

**Symptom 1 — api.avdanstore.com 502 while every other subdomain worked.** Root cause: nginx's
static `upstream { server api:8000; }` blocks in `infra/nginx/nginx.prod.conf` resolve the
container hostname once at nginx startup/reload and cache it — a deploy had recreated the `api`
container onto a new Docker bridge IP, and the IP it vacated was later reassigned to `web-hub`.
nginx kept proxying every request to `web-hub`'s IP on port 8000 (nothing listening there) ->
connection refused -> 502. The other 5 subdomains hadn't hit this yet only because their
container IPs happened not to have moved since nginx's last reload — it was latent for all of
them, not a bug specific to `api`.

Fixed live via `nginx -s reload` (immediate relief), then root-caused in
`infra/nginx/nginx.prod.conf`: `resolver 127.0.0.11 valid=10s;` (Docker's embedded DNS) + a
`set $upstream ...; proxy_pass http://$upstream:PORT;` variable per location, which makes nginx
re-resolve periodically instead of caching indefinitely. Deployed and verified across all 6
subdomains.

**Symptom 2 — the real one underneath: postgres and redis containers didn't exist at all.**
`avdan-api-1`'s healthcheck only hits a static `/health` (never touches the DB), so it reported
"healthy" throughout. A real endpoint (`GET /vendors`) returned `INTERNAL_ERROR`, and Celery was
retrying `Cannot connect to redis://:**@redis:6379/1: ... Temporary failure in name resolution`
in a loop (its own built-in reconnect backoff — the container itself was never crash-looping).
Confirmed via `getent hosts redis`/`postgres` from inside `avdan-api-1`: neither resolved,
because no such containers existed on the host at all — not even stopped/exited, fully removed.
`postgres`'s own control-file log ("database system was shut down at 2026-07-30") and Redis's
RDB age (~33 days) put the actual outage start around **2026-07-30**, i.e. **this had been down
for about a month** before this session found it.

**Root cause, confirmed (not the disk-pressure theory below — that was a red herring):**
`.github/workflows/deploy-prod.yml` runs `docker compose -f docker-compose.prod.yml up -d
--remove-orphans` on every deploy. `docker-compose.infra.yml` (postgres + redis) lived in the
same `/opt/avdan/` directory with no explicit project name, so Compose inferred the **same**
project name ("avdan") for both files — making `postgres`/`redis` look like orphaned containers
to every single prod deploy, which then removed them. This is why they had `restart:
unless-stopped` yet were still fully gone: `--remove-orphans` removes the container outright, a
restart policy never gets a chance to apply. **Reproduced live**: recovered the containers, then
~2 hours later found them gone again — a deploy had run again in between and removed them the
same way. Fixed by giving `docker-compose.infra.yml` its own explicit project name
(`name: avdan-infra` at the top of the file) and pinning its volumes/network as `external: true`
by their real names (`avdan_postgres_data`, `avdan_redis_data`, `avdan_avdan`) so it keeps
reusing the same data and the same shared network under the new project identity. **Verified**:
ran the exact `docker compose -f docker-compose.prod.yml up -d --remove-orphans` command directly
afterward — postgres/redis survived it this time, `getent hosts postgres`/`redis` from
`avdan-api-1` still resolve correctly (Compose sets DNS aliases from service names regardless of
project name, as long as containers share the network), and data is intact (still 32 users).

Disk pressure (87% full, 12.96GB reclaimable) is real and was cleared regardless — see below —
but was not the actual trigger; leaving that in place would have looked like the outage was fixed
while the exact same `--remove-orphans` mechanism silently repeated on the next deploy.

Data was intact: both named volumes (`avdan_postgres_data`, `avdan_redis_data`) were untouched.
Recovered by starting the containers back onto their existing volumes (no data loss) — 32 users,
23 orders, latest activity July 5-11 (consistent with real but stale early-access data, not
corruption). The API and Celery both reconnected on their own the moment the containers came up,
no restart needed. Also ran `docker image prune -a` while there: reclaimed 17.36GB, disk now at
29% instead of 87%.

**Also fixed on the server** (deliberately not committed here — docker-compose files are scp'd
to the server directly rather than git-tracked, per existing practice): the production
`docker-compose.infra.yml` (postgres + redis) had a hardcoded placeholder password
(`REPLACE_WITH_STRONG_PASSWORD`) that Postgres happened to ignore (existing volume) but would
have handed Redis a wrong password on every fresh start. Now parameterized on the server via
`${POSTGRES_PASSWORD}` / `${REDIS_PASSWORD}`, with real values in `/opt/avdan/.env.infra`
(server-only, same handling as every other `.env` secret). Starting/updating it is still a
manual `docker compose --env-file .env.infra -f docker-compose.infra.yml up -d` on the server,
same as before this incident.

**Recommended follow-up:** the project-name fix should stop this specific mechanism for good, but
nothing would have caught either occurrence quickly on its own — `avdan-api-1`'s healthcheck
never touches the DB. Worth adding a real healthcheck (one that actually queries Postgres) and/or
an alert on `postgres`/`redis` container presence, as defense in depth against whatever the next
surprise turns out to be.

## 8. Smaller items

- [ ] `rider_profiles` is dead schema (0 rows) next to the real `riders` table, and
      `get_or_create_rider` gates on it — rider auto-provisioning is broken for any user without
      a row. Works today only because seed writes `riders` directly. Drop or populate.
- [ ] `/auth/me` returns `created_at: ""` instead of a timestamp.
- [ ] Vendor create/update does not enqueue `generate_vendor_embedding`, so vendor rows edited
      after a backfill keep a stale embedding.
- [ ] Rotate the Resend API key in `apps/api/.env` if it has ever been shared (file is gitignored
      and untracked — not in git history).
- [x] **Celery worker + Beat now run locally and clean — 2026-08-31.** First real run surfaced and
      fixed a mapper-registration crash that had silently killed most order-status notifications;
      see `STATUS_BACKEND.md` 14.11.
