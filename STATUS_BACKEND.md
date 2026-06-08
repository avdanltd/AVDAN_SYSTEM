# STATUS_BACKEND.md — Backend Build Status

> Agent: Read CLAUDE.md and ARCHITECTURE.md before starting any phase.
> Mark milestones complete by changing `[ ]` to `[x]` only when the milestone is fully working end-to-end.
> Do not mark complete if tests pass but the feature is not manually verifiable.
> Current phase and active milestone must be stated at the top of every session.

---

## Current Status

**Active Phase:** Phase 11
**Active Milestone:** 11.1 — Performance
**Last Completed:** Phase 10 — Analytics & Admin Config ✓ (2026-06-06)
**Blocking Issues:** None

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

### 11.1 Performance
- [ ] Database indexes added for all common query patterns (order status, user_id FKs, rider zone)
- [ ] `EXPLAIN ANALYZE` run on top 10 most frequent queries — no sequential scans on large tables
- [ ] Response time for `GET /orders/{id}` < 100ms on local dev with 10K seed rows

### 11.2 Security Hardening
- [ ] All endpoints have explicit rate limiting via slowapi
- [ ] Role-specific rate limits: riders on `/tracking/location` get 30 req/min (GPS broadcasts), others get 60 req/min
- [ ] CORS configured to allow only `FRONTEND_URLS` env var values
- [ ] Sensitive fields never appear in logs (payment keys, passwords, tokens)
- [ ] SQL injection prevention verified (parameterised queries only — SQLAlchemy ORM ensures this)

### 11.3 Observability
- [ ] Structured JSON logging configured (not plain text)
- [ ] Request ID added to every request context and log line
- [ ] Prometheus metrics endpoint at `/metrics` (fastapi-prometheus)
- [ ] Key metrics exposed: request count, request duration, active WebSocket connections, Celery queue depth

### 11.4 K8s Manifests
- [ ] `infra/k8s/api-deployment.yaml` — 4 replicas, rolling update, liveness + readiness probes
- [ ] `infra/k8s/celery-deployment.yaml` — 2 replicas
- [ ] `infra/k8s/celery-beat-deployment.yaml` — exactly 1 replica, PodDisruptionBudget
- [ ] `infra/k8s/nginx-daemonset.yaml` — one per node
- [ ] `infra/k8s/postgres-statefulset.yaml` — PVC 200 GB
- [ ] `infra/k8s/redis-statefulset.yaml` — with Sentinel sidecar
- [ ] `infra/k8s/sealed-secrets/` — sealed secrets for all sensitive env vars
- [ ] GitHub Actions `deploy.yml` — builds, pushes GHCR, rolling deploys to staging (develop) and prod (main)

**Phase 11 complete when:** App deploys to K3s cluster via GitHub Actions. Monitoring stack running. All security controls verified. Performance baselines met.

---

## Notes for Agent

- Phases must be completed in order. Do not start Phase 3 before Phase 2 is marked complete.
- Tests should be written alongside each milestone, not after.
- Every migration must be reviewed before running against any non-local database.
- When starting a session, state which phase and milestone you are on before writing any code.
- If a milestone requires a decision not covered in CLAUDE.md or ARCHITECTURE.md, stop and ask.
