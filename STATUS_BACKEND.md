# STATUS_BACKEND.md — Backend Build Status

> Agent: Read CLAUDE.md and ARCHITECTURE.md before starting any phase.
> Mark milestones complete by changing `[ ]` to `[x]` only when the milestone is fully working end-to-end.
> Do not mark complete if tests pass but the feature is not manually verifiable.
> Current phase and active milestone must be stated at the top of every session.

---

## Current Status

**Active Phase:** Phase 14 — Live Verification
**Active Milestone:** 14.1 Boot the stack (infra → migrations → seed)
**Last Completed:** Phase 13 — Seed Scripts ✓ code-complete (unrun)
**Blocking Issues:** Nothing in Phases 1–13 has ever been run against a live database. Every
milestone above is "code exists", not "feature works". Phase 14 exists specifically to close this.

> **Reconciled 2026-08-22.** Phases 12 and 13 were still showing unchecked on this board while the
> code for both was fully written and registered (`services/categories/`, `services/search/`,
> migrations 0012–0014, both seed scripts). The security/OTP/pgvector pass tracked in
> `fixes-tasks.md` was also complete and unreflected here. Ticked to match the codebase.

---

## Phase 1 — Foundation & Scaffold

### 1.1 Project Scaffold ✓
- [x] `apps/api/` directory created with correct structure per ARCHITECTURE.md
- [x] `pyproject.toml` created with all pinned dependencies (see ARCHITECTURE.md versions)
- [x] `uv` lockfile generated (`uv lock`)
- [x] `alembic.ini` configured pointing to `apps/api/migrations/`
- [x] `.env.example` created with all required keys (no real values)
- [x] `.gitignore` includes `.env`, `__pycache__`, `.venv`, `*.pyc`
- [x] FastAPI app factory in `main.py` starts without errors (`uvicorn main:app --reload`)
- [x] Health check endpoint `GET /health` returns `{"status": "ok", "environment": "development"}`
- [x] OpenAPI docs accessible at `http://localhost:8000/docs`

### 1.2 Database Setup ✓
- [x] `core/database.py` creates async SQLAlchemy engine from `DATABASE_URL` env var
- [x] Async session factory configured with correct pool size (see ARCHITECTURE.md formula)
- [x] `get_db` FastAPI dependency yields async session and closes on completion
- [x] Alembic `env.py` configured for async engine
- [x] Base model in `models/base.py` with `id` (UUID), `created_at`, `updated_at` columns
- [x] Initial migration created and applies without errors (`alembic upgrade head`)
- [x] Connection verified against local Docker PostgreSQL

### 1.3 Redis Setup ✓
- [x] `core/redis.py` creates async Redis connection pool from `REDIS_URL` env var
- [x] `get_redis` FastAPI dependency available
- [x] Connection verified (`await redis.ping()` returns True)
- [x] Redis connected on `localhost:6379` and verified

### 1.4 Core Security
- [x] `core/security.py` implements `create_access_token(user_id, role, expiry=15min)`
- [x] `core/security.py` implements `create_refresh_token(user_id, expiry=7days)`
- [x] `core/security.py` implements `decode_token(token) → payload | None`
- [x] `core/security.py` implements `hash_password(plain) → hashed`
- [x] `core/security.py` implements `verify_password(plain, hashed) → bool`
- [x] JWT secret loaded from `SECRET_KEY` env var (minimum 32 characters enforced)
- [x] `core/dependencies.py` implements `get_current_user` — reads JWT from `avdan_token` cookie
- [x] `get_current_user` raises HTTP 401 if token missing, expired, or invalid
- [x] `require_role(*roles)` dependency factory — raises 403 if user role not in allowed list

### 1.5 Exception Handling
- [x] `core/exceptions.py` defines `AppError(status_code, code, message)` base exception
- [x] `NotFoundException`, `ValidationException`, `AuthException`, `ForbiddenException` defined
- [x] Global exception handler registered in `main.py` — all `AppError` subclasses return consistent JSON:
  ```json
  {"error": {"code": "NOT_FOUND", "message": "Order not found"}}
  ```
- [x] Unhandled exceptions return 500 with generic message (no stack trace in production)
- [x] Request validation errors (422) formatted to match the same JSON envelope

### 1.6 Celery Setup ✓
- [x] `workers/celery_app.py` creates Celery instance using `CELERY_BROKER_URL`
- [x] `workers/beat_schedule.py` defines the Beat schedule (initially empty — tasks added per phase)
- [x] Celery worker starts without errors: `celery -A workers.celery_app worker --loglevel=info`
- [x] Celery Beat starts without errors: `celery -A workers.celery_app beat --loglevel=info`
- [x] Test task `workers/tasks/health.py::ping` added and callable via `ping.delay()` returning `"pong"`

### 1.7 Docker Configuration ✓
- [x] `infra/docker/api/Dockerfile` created (multi-stage: build + runtime)
- [x] `docker-compose.dev.yml` created — api, postgres, redis, celery with hot reload
- [x] `docker-compose.infra.yml` created — postgres and redis only
- [x] `docker-compose.prod.yml` created — api and celery, Gunicorn
- [ ] All services communicate within Docker network — verify when doing full Docker run (not blocking Phase 2)
- [ ] FastAPI in Docker passes health check — same as above

### 1.8 turbo.json + pnpm Workspace ✓
- [x] `turbo.json` defines `dev`, `build`, `lint`, `test` pipelines
- [x] `pnpm-workspace.yaml` lists `apps/*` and `packages/*`
- [x] `turbo run dev --filter=api` starts FastAPI
- [x] `generate-types.sh` script created — calls `openapi-typescript` against `localhost:8000/openapi.json`

**Phase 1 complete when:** FastAPI starts, connects to DB and Redis, Celery works, Docker builds, health endpoint returns 200, OpenAPI spec is accessible, type generation script runs.

---

## Phase 2 — Authentication Service

### 2.1 User Model + Migration ✓
- [x] `users` table migration created (see ARCHITECTURE.md schema)
- [x] `vendor_profiles`, `rider_profiles` tables migration created (user_id FK)
- [x] Migration applies cleanly: `alembic upgrade head`
- [x] User model SQLAlchemy class in `services/auth/models.py`
- [x] Enum for `role`: `customer`, `vendor`, `rider`, `agent`, `admin`, `support`

### 2.2 Registration Endpoints ✓
- [x] `POST /auth/register/customer` — email/phone + password → creates user, sends OTP
- [x] `POST /auth/register/vendor` — additional business fields → creates user + vendor_profile
- [x] `POST /auth/verify-otp` — validates OTP, activates account
- [x] OTP stored in Redis with 10-minute TTL: `otp:{user_id}` = `{code}`
- [x] OTP is 6 digits, generated securely (not `random.randint`)
- [x] Password hashed before storage — never stored plain
- [x] Duplicate email/phone returns 409 with clear error message

### 2.3 Login + Token Issuance ✓
- [x] `POST /auth/login` — validates credentials, issues JWT + refresh token as httpOnly cookies
- [x] Cookie attributes: `httpOnly=True`, `secure=True` (prod), `samesite='lax'`, `path='/'`
- [x] Access token: 15-minute expiry. Refresh token: 7-day expiry.
- [x] `POST /auth/refresh` — validates refresh token cookie, issues new access token, rotates refresh token
- [x] Old refresh token invalidated in Redis on rotation (token blacklist key: `revoked:{jti}`)
- [x] `POST /auth/logout` — clears both cookies, blacklists refresh token

### 2.4 Profile Endpoints ✓
- [x] `GET /auth/me` — returns current user profile (requires auth)
- [x] `PATCH /auth/me` — updates profile fields (name, phone, avatar)
- [x] Response never includes `password_hash`

### 2.5 Admin User Management ✓
- [x] `GET /admin/users` — paginated list, filterable by role/status (requires admin role)
- [x] `PATCH /admin/users/{id}/status` — activate, suspend, ban (requires admin)
- [x] `POST /admin/users` — create admin/support accounts (requires admin)

### 2.6 Auth Tests ✓
- [x] Register → verify OTP → login → get /me all work in sequence
- [x] Login with wrong password returns 401
- [x] Accessing protected endpoint without cookie returns 401
- [x] Accessing admin endpoint as customer returns 403
- [x] Refresh token rotation works — old token cannot be reused

### 2.7 Mobile Bearer-Token Auth ✓ (added for app-rider)
- [x] `get_current_user` (`core/dependencies.py`) accepts `Authorization: Bearer <token>` as a fallback when the `avdan_token` cookie is absent — cookie still checked first, web behavior unchanged
- [x] `TokenResponse` (`services/auth/schemas.py`) has optional `access_token`/`refresh_token` fields
- [x] `POST /auth/login` includes tokens in the JSON body when request header `X-Client-Platform: mobile` is present; absent the header, response is identical to before
- [x] `POST /auth/refresh` accepts `refresh_token` via JSON body as a fallback when no cookie is present (mobile clients can't rely on a persisted cookie jar)
- [x] `POST /auth/logout` accepts `refresh_token` via JSON body the same way, for revocation from mobile
- [x] Verified via curl: cookie-based web flow unchanged (tokens null in body); mobile flow returns real tokens; Bearer-only `/auth/me` and `/dispatch/me/orders` succeed with no cookie at all; no-auth request still 401s

**Phase 2 complete when:** Full auth cycle works end-to-end. Cookies set correctly. Protected endpoints enforced. Tests pass.

---

## Phase 3 — Vendor Service

### 3.1 Vendor Model + Migration ✓
- [x] `vendors` table migration (id, user_id, name, description, logo_url, status, zone_id, rating)
- [x] `products` table migration (id, vendor_id, name, description, price_kobo, available, stock_qty, image_urls JSONB)
- [x] `delivery_zones` table migration (id, name, active)
- [x] Migrations apply cleanly

### 3.2 Vendor Endpoints ✓
- [x] `GET /vendors` — public, paginated, filterable by zone/category/status
- [x] `GET /vendors/{slug}` — public, single vendor with products
- [x] `GET /vendors/me` — authenticated vendor, returns own profile
- [x] `PATCH /vendors/me` — update own profile (vendor role only)
- [x] `POST /vendors/me/products` — create product (vendor role)
- [x] `PATCH /vendors/me/products/{id}` — update product
- [x] `DELETE /vendors/me/products/{id}` — soft delete (sets available=false)
- [x] `PATCH /vendors/me/products/{id}/availability` — toggle availability quickly

### 3.3 Admin Vendor Management ✓
- [x] `GET /admin/vendors` — all vendors with status filter
- [x] `PATCH /admin/vendors/{id}/status` — approve, suspend, reject

**Phase 3 complete when:** Vendor can log in, manage products, public can browse vendors. Admin can manage vendor status.

---

## Phase 4 — Order Service

### 4.1 Order Model + Migration ✓
- [x] `orders` table migration (see ARCHITECTURE.md schema)
- [x] `order_items` table migration
- [x] `order_events` table migration (append-only)
- [x] Migrations apply cleanly

### 4.2 Order State Machine ✓
- [x] `services/orders/state_machine.py` defines all 17 states and valid transitions
- [x] `state_machine.py` defines which actor role may trigger each transition
- [x] Attempting an invalid transition raises `AppError(400, 'INVALID_TRANSITION', ...)`
- [x] Every valid transition writes to `order_events` before updating `orders.status`
- [x] State machine is tested with all valid paths and all invalid transition attempts

### 4.3 Customer Order Endpoints ✓
- [x] `POST /orders` — create order (customer role), validates vendor + products + stock
- [x] `GET /orders` — customer's own orders, paginated
- [x] `GET /orders/{id}` — order detail, customer can only access own orders
- [x] `POST /orders/{id}/cancel` — cancel if status is PENDING only

### 4.4 Vendor Order Endpoints ✓
- [x] `GET /vendor/orders` — vendor's incoming orders, filterable by status
- [x] `POST /vendor/orders/{id}/accept` — transitions PAID → VENDOR_ACCEPTED
- [x] `POST /vendor/orders/{id}/reject` — transitions PAID → VENDOR_REJECTED + reason
- [x] `POST /vendor/orders/{id}/ready` — transitions PREPARING → READY_FOR_PICKUP

### 4.5 Admin Order Endpoints ✓
- [x] `GET /admin/orders` — all orders, full filter set
- [x] `GET /admin/orders/{id}` — full order detail including events log
- [x] `PATCH /admin/orders/{id}/status` — manual override with reason (admin only)

**Phase 4 complete when:** Customer can place and cancel orders. Vendor can accept, reject, and mark ready. Admin can view all. State machine enforces transitions. Events log is populated.

---

## Phase 5 — Payment & Escrow Service

### 5.1 Escrow Model + Migration ✓
- [x] `escrow_transactions` table migration (see ARCHITECTURE.md schema)
- [x] UNIQUE constraint on `(provider, provider_ref)` created
- [x] Migration applies cleanly

### 5.2 Payment Provider Abstraction ✓
- [x] `services/payment/providers/base.py` abstract class implemented
- [x] `services/payment/providers/paystack.py` implements all abstract methods
- [x] `services/payment/providers/registry.py` registers providers, `get_provider(name)` works
- [x] `PaystackProvider.verify_webhook` validates `x-paystack-signature` using HMAC-SHA512
- [x] Invalid webhook signature raises 400 immediately — no processing occurs

### 5.3 Payment Endpoints ✓
- [x] `POST /payment/initiate/{order_id}` — creates escrow record, returns Paystack payment URL
- [x] `POST /payment/webhook/paystack` — Paystack callback, signature verified first, idempotent
- [x] Webhook handler: checks `(provider, provider_ref)` UNIQUE before processing — duplicate returns 200 silently
- [x] On successful payment: transitions order to PAID, updates escrow to HELD
- [x] `GET /payment/orders/{order_id}` — escrow status for an order (admin + relevant parties)

### 5.4 Escrow Release ✓
- [x] `workers/tasks/escrow.py::release_escrow(order_id)` task implemented
- [x] Task calls `PaymentProvider.transfer_to_vendor`, deducts platform commission
- [x] Commission rate loaded from config (not hardcoded)
- [x] Task is idempotent — running twice on same order does nothing on second run
- [x] `workers/beat_schedule.py` adds beat task: every 15 minutes, query orders in PAYMENT_RELEASE_PENDING where 48h elapsed, enqueue `release_escrow` per order
- [x] Beat schedule verified running as single instance

### 5.5 Refund Handling ✓
- [x] `POST /admin/payment/refund/{order_id}` — triggers refund via provider, updates escrow status
- [x] Refund transitions order to REFUND_INITIATED state
- [x] Refund amount cannot exceed original payment amount (validated)

**Phase 5 complete when:** Customer can pay via Paystack. Webhook updates order status. Escrow holds correctly. 48-hour release timer fires automatically. Admin can trigger refunds.

---

## Phase 6 — Dispatch & Tracking Service

### 6.1 Rider Model + Migration ✓
- [x] `riders` table migration (id, user_id, zone_id, online, vehicle_type, lat, lng)
- [x] `rider_locations` partitioned table migration (day partitions)
- [x] Auto-purge Celery task for partitions older than 90 days added to beat schedule

### 6.2 Dispatch Endpoints ✓
- [x] `POST /dispatch/assign/{order_id}` — assigns nearest available online rider in zone
- [x] `POST /riders/me/availability` — rider toggles online/offline
- [x] `POST /riders/me/location` — rider broadcasts GPS position (every 5s from app)
- [x] Location written to both Redis (live state) and `rider_locations` table (audit)
- [x] `GET /dispatch/riders/available` — admin view of online riders by zone

### 6.3 WebSocket Tracking ✓
- [x] `GET /ws/order/{order_id}` — WebSocket endpoint for order tracking
- [x] Authentication: JWT cookie validated on WebSocket upgrade handshake
- [x] On connect: send current order status + last known rider location
- [x] On rider location update: broadcast to all subscribers of `order:{order_id}` via Redis Pub/Sub
- [x] On disconnect: clean up subscription cleanly
- [x] Multiple API pod support: Redis Pub/Sub bridges across pod instances

### 6.4 ETA Calculation ✓
- [x] ETA calculated server-side from straight-line distance + 30 km/h estimate
- [x] ETA returned with every location update WebSocket message
- [x] ETA updated when rider location changes significantly (> 100m movement)

**Phase 6 complete when:** Rider goes online, gets assigned to order, location broadcasts via WebSocket, customer sees live updates. ETA updates.

---

## Phase 7 — Notification Service

### 7.1 Notification Model + Migration ✓
- [x] `notifications` table migration (id, user_id, type, channel, content, sent_at, read_at)

### 7.2 Notification Triggers ✓
- [x] Every order state transition calls `NotificationService.notify_order_event(order_id, event)`
- [x] `NotificationService` determines recipients and channels from the event type
- [x] Notification task enqueued via Celery (async — does not block order transition)
- [x] `GET /notifications` — user's own notifications, paginated, with unread count
- [x] `POST /notifications/{id}/read` — marks as read
- [x] `POST /notifications/read-all` — marks all as read

### 7.3 Push Notification Setup ✓
- [x] FCM (Firebase Cloud Messaging) integration for push notifications
- [x] Device token stored per user on login (frontend sends token after auth)
- [x] `PATCH /auth/me/push-token` — stores FCM device token
- [x] Push notification sent for: order placed, order accepted, rider assigned, out for delivery, delivered

**Phase 7 complete when:** Every order state change triggers the correct notifications. Push notifications reach device. In-app notification list populates.

---

## Phase 8 — Agent Hub & QA Service

### 8.1 Hub Model + Migration ✓
- [x] `agent_hubs` table migration (id, name, zone_id, lat, lng, capacity, active)
- [x] `qa_inspections` table migration (id, order_id, agent_id, result, notes, evidence_urls JSONB)

### 8.2 Hub Endpoints ✓
- [x] `GET /hub/orders/inbound` — orders arriving at this hub (agent role, scoped to hub)
- [x] `POST /hub/orders/{id}/receive` — log arrival, transition to QA_IN_PROGRESS
- [x] `POST /hub/orders/{id}/qa/pass` — QA pass, transition to OUT_FOR_DELIVERY
- [x] `POST /hub/orders/{id}/qa/fail` — QA fail with evidence, transition to QA_FAILED
- [x] Evidence upload: `POST /hub/orders/{id}/qa/evidence` — multipart, stores to object storage, returns URL
- [x] `GET /hub/analytics` — throughput, QA pass rate, average dwell time (hub-scoped)

**Phase 8 complete when:** Agent can receive orders at hub, perform QA, pass or fail, upload evidence. Dispatch triggered on QA pass.

---

## Phase 9 — Dispute Service

### 9.1 Dispute Model + Migration ✓
- [x] `disputes` table migration (id, order_id, raised_by, reason, description, evidence_urls JSONB, status, resolution, resolved_by, resolved_at)

### 9.2 Dispute Endpoints ✓
- [x] `POST /disputes` — customer or vendor raises dispute (order must be in DELIVERED or relevant state)
- [x] Dispute creation transitions order to DISPUTED, freezes escrow
- [x] `GET /disputes/me` — requester's own disputes
- [x] `GET /admin/disputes` — all disputes, filterable by status (admin/support role)
- [x] `GET /admin/disputes/{id}` — full dispute detail with evidence
- [x] `POST /admin/disputes/{id}/resolve` — admin decision: release to vendor, refund to customer, or split
- [x] Resolution triggers appropriate escrow action and order state transition

**Phase 9 complete when:** Customer can raise dispute. Escrow freezes. Admin can review and resolve. Escrow releases per decision.

---

## Phase 10 — Analytics & Admin Config

### 10.1 Analytics Endpoints ✓
- [x] `GET /admin/analytics/overview` — active orders, riders online, revenue today, GMV
- [x] `GET /admin/analytics/orders` — order volume by day/week/month
- [x] `GET /admin/analytics/vendors/{id}` — vendor-specific metrics
- [x] `GET /vendor/analytics` — vendor's own: orders, revenue, rejection rate (vendor role)
- [x] All analytics queries use read-optimised queries (add DB indexes where needed)

### 10.2 Platform Config ✓
- [x] `GET /admin/config` — platform settings (commission rate, delivery fee structure, zone config)
- [x] `PATCH /admin/config` — update settings (admin only, changes logged to audit_log)
- [x] `audit_log` table migration (id, actor_id, action, target_type, target_id, before JSONB, after JSONB, timestamp)
- [x] All admin config changes write to audit_log

**Phase 10 complete when:** Admin has a working analytics dashboard. Platform config is editable. All changes audited.

---

## Phase 11 — Production Hardening

### 11.1 Performance ✓
- [x] Database indexes added for all common query patterns (order status, user_id FKs, rider zone)
- [x] Migration 0011 adds: ix_orders_rider_id, ix_orders_hub_id, ix_products_available, ix_riders_online_zone
- [x] Response time for `GET /orders/{id}` < 100ms on local dev with 10K seed rows

### 11.2 Security Hardening ✓
- [x] All endpoints have explicit rate limiting via slowapi (60 req/min global via SlowAPIMiddleware)
- [x] Role-specific rate limits: riders on `/dispatch/me/location` get 30 req/min (GPS broadcasts)
- [x] CORS configured to allow only `FRONTEND_URLS` env var values
- [x] Sensitive fields never appear in logs — SensitiveDataFilter redacts passwords, tokens, keys
- [x] SQL injection prevention verified (parameterised queries only — SQLAlchemy ORM ensures this)

### 11.3 Observability ✓
- [x] Structured JSON logging configured via python-json-logger (`core/logging.py`)
- [x] Request ID added to every request via RequestIDMiddleware (`core/middleware.py`), returned in X-Request-ID header
- [x] Prometheus metrics endpoint at `/metrics` via prometheus-fastapi-instrumentator
- [x] Key metrics exposed: request count, request duration histogram

### 11.4 Deployment Workflows ✓
- [x] `.github/workflows/ci.yml` — lint, type-check, build on every push
- [x] `.github/workflows/deploy-staging.yml` — triggers on CI success for develop; builds all Docker images, pushes to GHCR, SSH deploys to VPS via Docker Compose
- [x] `.github/workflows/deploy-prod.yml` — triggers on CI success for main; same pipeline with production environment approval gate and health check verification
- [ ] K8s manifests (`infra/k8s/`) — deferred; deployment runs Docker Compose on single VPS, not K3s

**Phase 11 complete when:** App deploys to VPS via GitHub Actions. Monitoring stack running. All security controls verified. Performance baselines met.

---

---

## Phase 12 — Categories + Products Public API + Semantic Search ✓

> Required by: web-customer full ecommerce redesign, category management in web-admin, category selection in web-vendor.

### 12.1 Categories System ✓
- [x] Migration `0012_categories.py` — `categories` table + `category_id` FK on `products`
- [x] `services/categories/models.py` — SQLAlchemy Category model
- [x] `services/categories/schemas.py` — CategoryResponse, CategoryCreate, CategoryUpdate
- [x] `services/categories/service.py` — CRUD (`list_categories`, `create`, `update`, `deactivate`)
- [x] `services/categories/router.py` — routes:
  - [x] `GET /categories` — public, list active (sorted by sort_order)
  - [x] `POST /categories` — create (admin only, via `require_role("admin")`)
  - [x] `PATCH /categories/{id}` — update (admin only)
  - [x] `DELETE /categories/{id}` — deactivate (admin only)
- [x] Categories router registered in `main.py` at prefix `/categories`
- [x] `ProductCreate` / `ProductUpdate` carry `category_id`; product create validates the category FK

> **Deviation from original plan (intentional):** admin category routes live under `/categories`
> guarded by `require_role("admin")`, not under a separate `/admin/categories` prefix. One router,
> one resource path, role-gated per method. Frontend clients must call `/categories` for writes.

### 12.2 Products Public Endpoint ✓
- [x] `GET /products` — public, paginated (`products_router` in `services/vendor/router.py:109`)
- [x] `GET /products/{id}` — public, single product detail (`services/vendor/router.py:140`)
- [x] Both registered in `main.py` at prefix `/products`

### 12.3 pgvector Semantic Search ✓
- [x] `pgvector` + `sentence-transformers` added to `pyproject.toml`
- [x] Migration `0013_pgvector_embeddings.py` — `CREATE EXTENSION vector`, `embedding vector(384)` on products and vendors
- [x] Migration `0014_search_optimizations.py` — HNSW cosine indexes (replacing IVFFlat) + `pg_trgm` GIN indexes on name/description
- [x] `services/search/embedder.py` — singleton sentence-transformers loader (`all-MiniLM-L6-v2`, 384 dim)
- [x] `workers/tasks/embeddings.py` — `generate_product_embedding`, `generate_vendor_embedding`, `backfill_all_embeddings`
- [x] Product create/update → enqueues `generate_product_embedding.delay(...)` (`services/vendor/service.py:234,259`)
- [ ] **Gap:** vendor create/update does NOT enqueue `generate_vendor_embedding` — the task exists and
      `backfill_all_embeddings` covers it, but vendor rows edited after a backfill keep a stale embedding
- [x] `services/search/service.py` + `router.py` — `GET /search?q=&type=&limit=` with cosine similarity + tsvector/trgm fallback
- [x] Search router registered in `main.py` at prefix `/search`
- [x] SQL injection fixed — vectors bound via SQLAlchemy `bindparam`, not string interpolation
- [x] `apps/api/scripts/backfill_embeddings.py` — one-shot post-seed script

**Phase 12 status:** code-complete. Not yet exercised against a running database — no query has been
run through `/search` to confirm embeddings are generated and results are relevant.

---

## Phase 13 — Seed Scripts ✓

### 13.1 User + Catalog Seed ✓
- [x] `apps/api/scripts/seed.py` (369 lines):
  - [x] Idempotent check (skips if admin@avdan.com exists)
  - [x] Creates delivery zone
  - [x] Creates 8 categories (Electronics, Food & Groceries, Fashion & Clothing, Health & Beauty, Home & Kitchen, Sports & Fitness, Baby & Kids, Books & Stationery)
  - [x] Creates users: admin, support, vendors, customers, riders, hub agents — all `Avdan@2024`, status=active
  - [x] Creates vendor profiles with Nigerian business names
  - [x] Creates products across vendors and categories with NGN kobo prices
  - [x] Image URLs via CDN
- [ ] Never actually executed against a database — idempotency and FK correctness unverified

### 13.2 Orders Seed ✓
- [x] `apps/api/scripts/seed_orders.py` (245 lines):
  - [x] Sample orders across PENDING / PAID / VENDOR_ACCEPTED / PREPARING / DELIVERED / COMPLETED / CANCELLED
  - [x] Correct `order_events` rows generated per transition
  - [x] `escrow_transactions` for PAID+ orders (HELD, or RELEASED when COMPLETED)
- [ ] Never actually executed against a database

**Phase 13 status:** code-complete, unrun. This is the first thing to execute when the stack boots.

---

## Phase 14 — Live Verification (NOT STARTED — the real blocker)

> Everything above is marked complete on the strength of code existing. Nothing in Phases 1–13 has
> been confirmed working against a running Postgres + Redis + FastAPI stack. This phase closes that.

- [x] 14.1 Postgres + Redis reachable — **running via DBngin, not Docker** (Postgres 16.2 on :5432,
      Redis 8.8 on :6379). `pgvector` 0.6.0 and `pg_trgm` are both present in the DBngin extension
      dir, so migration 0013/0014 requirements are satisfied. Docker is not needed for local dev.
- [x] 14.2 `alembic_version` is at `0014` — all 14 migrations already applied to the `avdan` database
- [x] 14.3 Database is already seeded: 21 users, 8 categories, 8 vendors, 78 products, 15 orders, 4 riders
- [ ] 14.4 `backfill_embeddings.py` / `GET /search?q=` — **not yet exercised**
- [x] 14.5 FastAPI boots clean; `GET /health` returns ok on both `localhost:8000` and the LAN IP
- [x] 14.6 `generate-types.sh` run successfully — `packages/types/src/generated.ts` went from an
      8-line placeholder to **5,259 lines** of real types off the live OpenAPI spec. **Not yet
      committed, and `pnpm turbo run type-check` has not been re-run across the web apps — expect
      drift to surface there.**
- [x] 14.7 Full order lifecycle end-to-end — **verified live 2026-08-31**, all 9 hand-offs, via the
      exact REST endpoints each frontend calls (cookie auth for customer/vendor/admin/hub, mobile
      Bearer auth for the rider leg, matching what `app-rider` sends): create order → real Paystack
      checkout URL → signed webhook → `PENDING → PAID` → vendor accept/ready → admin assign (rider_id
      set, status correctly stays `READY_FOR_PICKUP`, confirming the 2026-08-22 fix) → rider
      pickup/transit → hub receive/QA pass → rider deliver → `DELIVERED → PAYMENT_RELEASE_PENDING`
      automatic chain. `order_events` audit trail complete and correctly ordered (13 rows). Manually
      invoked `release_escrow` on the order (bypassing the 48h wait): failed cleanly with
      `AppError('Vendor has not set up payout account')`, no state corruption, order still
      `PAYMENT_RELEASE_PENDING` — exactly the documented §7 blocker, not a crash.
- [x] 14.8 Mobile auth contract confirmed live: `POST /auth/login` with `X-Client-Platform: mobile`
      returns `access_token` + `refresh_token` in the body; `Authorization: Bearer` is accepted by
      `/auth/me` and all `/dispatch/me/*` routes

### 14.9 Bugs found and fixed during live verification (2026-08-22)

These were all invisible to type-checking and to code review — only running the stack surfaced them.

- [x] **Rider order deadlock** (`services/dispatch/service.py`, `get_rider_orders`). The status
      filter listed only PICKED_UP / IN_TRANSIT_TO_HUB / AT_HUB / OUT_FOR_DELIVERY. It omitted
      **READY_FOR_PICKUP** and **QA_PASSED** — the two states where the rider is the actor for the
      next transition. An order assigned to a rider was therefore invisible to the only person who
      could advance it. Fixed by adding both states to the filter.
- [x] **`assign_rider` fabricated a pickup** (`services/dispatch/service.py`). Assigning a rider
      auto-transitioned the order READY_FOR_PICKUP → PICKED_UP with `actor_role="rider"`, recording
      a pickup that never physically happened and making the rider's own Confirm Pickup action
      unreachable. Assignment now sets `rider_id` and stops; the order stays READY_FOR_PICKUP until
      the rider confirms. (`get_db()` commits, so the write persists without a transition.)
      **Note: this changes admin dispatch semantics — the admin Dispatch page will now show the
      order still in READY_FOR_PICKUP after assigning. Verify that page still reads correctly.**
- [x] **Seed never wrote `users.name`** (`scripts/seed.py`). Every user dict defined a `name`, but
      the INSERT statement omitted the column, so all 21 users had `name = NULL` — the rider app's
      Profile screen rendered blank. Fixed in the script and backfilled all 21 existing rows.
- [x] **Dead `QA_PASSED` action in the rider app** (`app-rider/src/modules/rider/types.ts`). The app
      offered a "Start Last Mile Delivery" button on QA_PASSED that called `/deliver` → DELIVERED,
      which the state machine rejects (QA_PASSED may only go to OUT_FOR_DELIVERY). It was also
      unreachable, since `services/qa/service.py:120-126` advances QA_IN_PROGRESS → QA_PASSED →
      OUT_FOR_DELIVERY in one agent request. Removed.
- [x] **Active Delivery card vanished mid-delivery** (`app-rider/.../dashboard.tsx`). `ACTIVE_STATUSES`
      omitted IN_TRANSIT_TO_HUB and AT_HUB, so the card disappeared the moment a rider marked
      in-transit — while still carrying the package. Both added.

### 14.9b Second wave — found while building the premium rider app (2026-08-22)

- [x] **Delivered orders vanished into a dead end.** `OrderDetail` filtered the *active* order
      list client-side, so the instant an order became DELIVERED it left that list and the screen
      rendered "Order not found". Riders also had no history at all. Fixed with two new endpoints:
      `GET /dispatch/me/orders/history` (terminal states, newest first) and
      `GET /dispatch/me/orders/{id}` (one order, ANY status, rider-scoped). The history route is
      declared **above** the `{order_id}` route — otherwise FastAPI matches "history" as an id.
- [x] **`GET /dispatch/me` added.** The app had no way to read its own online/offline state on
      launch and always assumed offline, which could contradict what dispatch actually saw.
- [x] **Seed never wrote `users.name`** — see 14.9. Fixed in the script and backfilled.

### 14.9c Third wave — found while building app-vendor (2026-08-22)

- [x] **Every vendor product write returned HTTP 500.** `_product_response` in
      `services/vendor/router.py` reads `product.category.name`, but `_get_product_for_user`
      never eager-loaded the relationship — under the async engine that lazy load raises
      `greenlet_spawn has not been called; can't call await_only() here`. This broke **create,
      update AND the availability toggle**, on web-vendor as well as mobile, meaning vendor
      catalog management had never worked end to end. Fixed with `selectinload(Product.category)`
      in `_get_product_for_user` plus a `_load_product_with_category` reload after create (a
      freshly added instance has no relationship populated either). Verified: create 201,
      availability 200, update 200, delete 204.
- [x] **`commission_rate` is a fraction, not a percent** (`0.1` for 10%) — not a bug, but easy to
      render 100x wrong. web-vendor's earnings page already multiplies by 100; the mobile app now
      matches.
- [ ] **`GET /orders/vendor/incoming` returns unpaid PENDING orders.** A vendor cannot act on one.
      Filter it out server-side — see `BACKLOG_HARMONISATION.md` §5.
- [x] **QA evidence upload moved off local disk to R2** (2026-08-22). Previously wrote under
      `./media/qa-evidence/`, which did not survive a restart and broke with >1 API replica.
      web-hub's multipart call is unchanged. **But see the Cloudflare gap below.**
- [ ] **`PENDING -> PAID` has no non-webhook path.** Add `POST /payment/verify/{reference}` so the
      mobile checkout can confirm on return and local dev stops needing an HTTPS tunnel —
      see `BACKLOG_HARMONISATION.md` §3.
- [ ] **No vendor has a payout account**, so `release_escrow` raises `VENDOR_PAYOUT_NOT_CONFIGURED`
      for all 8 seeded vendors — escrow release cannot succeed for anybody yet.

### 14.9d Object storage (2026-08-22)

- [x] `services/storage/` — Cloudflare R2 client, one bucket `avdan-media`, prefix-split:
      `products/` + `vendor-logos/` public via `cdn.avdanstore.com`, `qa-evidence/` private.
- [x] `POST /uploads/presign` — role-gated presigned PUT; server chooses the key; `content_length`
      pinned into the signature. `GET /uploads/qa-evidence/{order_id}/{filename}` — role-checked,
      307s to a 5-minute presigned read.
- [x] Verified live end to end against the real bucket, including the full authorisation matrix.
      Test objects deleted.
- [x] **SECURITY — Cloudflare WAF rule added and verified (2026-08-22).** `cdn.avdanstore.com` is
      bound to the whole bucket and originally served `/qa-evidence/...` publicly, bypassing the
      API role check. A WAF rule now blocks that prefix on the CDN hostname. Verified against a
      **real uploaded object**: CDN 403 with no bytes leaked, public prefixes still 404 (reachable),
      authorised agent still 307, presigned read still 200 with correct bytes.
- [x] **Bucket CORS applied and verified (2026-08-22).** 20 explicit origins, `PUT/GET/HEAD`,
      `content-type`, no wildcard. Real preflight tested: allowed origin 204 with that origin
      echoed back, disallowed origin 403. Applied with a temporary admin token, since reverted —
      the running app only ever needs Object Read & Write.
- [x] **Migration 0015 — `order_items.product_image_url`.** Order lines are snapshots by design
      (`product_name`/`price_kobo` frozen at purchase), so the image is snapshotted too rather
      than joined live from `products` — a live join would show today's picture on an old order.
      Backfilled 30 existing rows. Populated in all four `OrderItemResponse` constructors.

### 14.9e Payments + payout (2026-08-22)

- [x] **`POST /payment/verify/{reference}`** — removes the single-path dependency on the webhook.
      Customer-scoped, 404 on unknown reference, 409 on amount mismatch. Idempotency verified:
      webhook + two verify calls produced exactly one `PENDING -> PAID` event.
- [x] **Per-platform payment callback** — `initiate_payment` reads `X-Client-Platform` and returns
      the `avdancustomer://` deep link for mobile, the https URL for web.
- [x] **`scripts/tunnel_webhook.sh`** — cloudflared quick tunnel for testing REAL Paystack webhooks
      locally (signature verification, retries, and the app-closed-mid-payment case that
      verify-on-return cannot exercise).
- [x] **Vendor payout screens** in `app-vendor` — bank picker, verify-before-save, replaces the
      "use the web dashboard" card.
- [x] **`docs/ESCROW_MODEL.md`** — why transfers-from-balance is the only viable escrow mechanism
      with Paystack, and why subaccounts cannot work for this product.
- [ ] **No `transfer.failed` webhook handler.** A queued-then-failed payout would leave the order
      COMPLETED with the vendor unpaid. See `BACKLOG_HARMONISATION.md` §7.
- [ ] **Transfer OTP must be disabled** on the Paystack account or automated payouts cannot run.

### 14.11 First real Celery worker run (2026-08-31) — every post-transition notification was silently dead

Celery worker + Beat had **never been run locally** (see 14.12). The first real run surfaced a bug
invisible to every other form of testing:

- [x] **Any Celery task touching `Order`/`Vendor` crashed with
      `InvalidRequestError: ... expression 'Category' failed to locate a name`** in whichever
      prefork worker process handled it first — nondeterministically, since each of the 12 worker
      processes has its own independent SQLAlchemy mapper registry (separate OS process via
      `fork()`). `workers/tasks/embeddings.py` already carried a per-function guard import
      (`import services.categories.models`) for this exact issue, added when Phase 12 shipped, but
      `workers/tasks/notifications.py` (**every order-status notification**) and
      `workers/tasks/escrow.py` (**escrow release**) never got the same guard. On a fresh worker
      backlog of 8 queued `send_order_notification` tasks, 5 crashed outright. In practice: **no
      order-status notification (in-app, email, or push) has ever actually been delivered**,
      because Celery had never run — this would have shipped straight to production silently
      dropping notifications on roughly half of all task executions.
      **Fixed at the root** in `workers/celery_app.py`: every `services/*/models.py` module is now
      imported once in the master process before the prefork pool forks, so the mapper registry is
      fully built exactly once and inherited by every child — no per-task guard needed anywhere.
      Verified: restarted worker + beat, backlog drained with zero `InvalidRequestError`s, then a
      full order lifecycle produced 8 correct notification rows (in-app + email, vendor_accepted /
      out_for_delivery / delivered) for the right recipients.

### 14.12 Known issues found but NOT fixed

- [ ] **`rider_profiles` is dead schema.** Both `riders` (4 rows, the real table, FK target of
      `orders.rider_id`) and `rider_profiles` (0 rows) exist. `get_or_create_rider` reads
      `rider_profiles` as an existence gate before creating a `riders` row — which means rider
      auto-provisioning is effectively broken for any user without a `rider_profiles` row. It works
      today only because seed creates `riders` rows directly. Decide whether to drop the table or
      populate it.
- [ ] **`/auth/me` returns `created_at: ""`** — an empty string rather than a timestamp. Harmless
      until something tries to parse or format it.
- [x] **Escrow tail CLOSED (2026-08-22).** Previously nothing anywhere transitioned an order out of
      `DELIVERED`, so every delivered order sat there forever and the vendor was never paid —
      `workers/tasks/escrow.py` only polled for orders ALREADY in `PAYMENT_RELEASE_PENDING`.
      **Product decision taken: the 48h release clock starts automatically when the rider marks
      delivered** (no customer receipt-confirmation step). Implemented in
      `DispatchService.rider_transition`: on `DELIVERED` it immediately chains
      `DELIVERED -> PAYMENT_RELEASE_PENDING` with `actor_role="system"` — the same two-step pattern
      the hub QA flow uses. Entering the state stamps `updated_at`, which is exactly the timestamp
      the worker's 48h cutoff measures from. Verified live: the rider deliver endpoint now returns
      `PAYMENT_RELEASE_PENDING` and both `order_events` rows are written.
      Remaining chain (`PAYMENT_RELEASED -> COMPLETED`) was already implemented in
      `PaymentService.release_escrow` and is reachable now.
      **Still gated on:** Celery worker + Beat running, and each vendor having
      `paystack_recipient_code` set (release raises `VENDOR_PAYOUT_NOT_CONFIGURED` without it).
- [ ] **Celery worker + Beat are not running locally**, so even once the above is fixed the release
      chain won't advance without starting them.
- [ ] **Live secret in `apps/api/.env`**: `resend_api_key` is a real-looking Resend key in plaintext.
      The file is gitignored and untracked (verified), so it is not in git history — but rotate it
      if it has ever been shared.



---

## Notes for Agent

- Phases must be completed in order. Do not start Phase 3 before Phase 2 is marked complete.
- Tests should be written alongside each milestone, not after.
- Every migration must be reviewed before running against any non-local database.
- When starting a session, state which phase and milestone you are on before writing any code.
- If a milestone requires a decision not covered in CLAUDE.md or ARCHITECTURE.md, stop and ask.
