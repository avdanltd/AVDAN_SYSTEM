# ARCHITECTURE.md — AVDAN Technical Architecture Reference

> This is the technical reference document. Read CLAUDE.md first for agent instructions.
> This document describes what is built and why. CLAUDE.md describes how to build it.

---

## Platform Overview

AVDAN is a multi-sided logistics and commerce platform. Six actor types. Five frontends. One modular FastAPI backend. One PostgreSQL database. One Redis instance (development), Redis Sentinel (production).

**Domain:** avdanstore.com
**API:** api.avdanstore.com
**Staging prefix:** staging.avdanstore.com, staging-vendor.avdanstore.com, etc.

---

## Actor Roles

| Role | Interface | Key Capability |
|------|-----------|----------------|
| Customer | web-customer | Browse vendors, place orders, track delivery, pay |
| Vendor | web-vendor | Accept orders, manage catalog, view earnings |
| Rider | web-rider (web-first; native app future phase) | Receive jobs, navigate, confirm delivery |
| Agent Hub | web-hub | QA inspection, inbound/outbound dispatch |
| Admin | web-admin | Full platform oversight, config, financials |
| Support | web-admin (support role) | Dispute resolution, user help |

---

## Infrastructure

### Servers (Contabo)

| Node | Contabo Plan | Spec | Role | Cost |
|------|-------------|------|------|------|
| Node 1 | Cloud VPS 30 | 8 vCPU / 24 GB / 200 GB NVMe | K3s master + Nginx + API pods | $13.44/mo |
| Node 2 | Cloud VPS 20 | 6 vCPU / 12 GB / 100 GB NVMe | K3s worker + API pods + Celery | $6.72/mo |
| Node 3 | Cloud VPS 20 | 6 vCPU / 12 GB / 100 GB NVMe | PostgreSQL + Redis | $6.72/mo |

**Total: ~$30/month** (servers + Contabo Object Storage for backups)

Node 1 is the **only server with public ports 80 and 443 open**.
Nodes 2 and 3 are on Contabo's private LAN — unreachable from the internet.

### K3s Namespaces

| Namespace | Contents |
|-----------|----------|
| avdan-app | FastAPI (4 replicas), Nginx DaemonSet, Celery, Celery Beat, WebSocket gateway |
| avdan-staging | Same as avdan-app but on develop branch deployments |
| avdan-data | PostgreSQL StatefulSet (PVC 200 GB), Redis StatefulSet + Sentinel |
| avdan-obs | Prometheus, Grafana, Loki, Promtail |
| avdan-config | ConfigMaps, Sealed Secrets |

### DNS / Routing (Cloudflare)

All subdomains point to Node 1's single public IP. Nginx reads the `Host:` header and routes to the correct K8s Service.

```
avdanstore.com          → web-customer Service
vendor.avdanstore.com   → web-vendor Service
admin.avdanstore.com    → web-admin Service
hub.avdanstore.com      → web-hub Service
rider.avdanstore.com    → web-rider Service
api.avdanstore.com      → FastAPI Service
staging.avdanstore.com  → web-customer Service (staging namespace)
```

---

## Backend Architecture

### FastAPI Application Structure

```
apps/api/
├── main.py                     # App factory, lifespan, router registration
├── core/
│   ├── config.py               # Settings via pydantic-settings
│   ├── database.py             # Async SQLAlchemy engine + session factory
│   ├── redis.py                # Redis connection pool
│   ├── security.py             # JWT encode/decode, password hashing
│   ├── dependencies.py         # FastAPI dependencies (get_db, get_current_user, etc.)
│   └── exceptions.py           # Custom exception classes + handlers
├── services/
│   ├── auth/
│   │   ├── router.py           # Auth endpoints
│   │   ├── service.py          # Auth business logic
│   │   ├── schemas.py          # Pydantic request/response models
│   │   └── models.py           # SQLAlchemy models (if auth-specific)
│   ├── orders/
│   │   ├── router.py
│   │   ├── service.py          # Order state machine lives here
│   │   ├── schemas.py
│   │   ├── models.py
│   │   └── state_machine.py    # Explicit state transition definitions
│   ├── payment/
│   │   ├── router.py
│   │   ├── service.py          # Escrow logic — calls provider abstraction only
│   │   ├── schemas.py
│   │   ├── providers/
│   │   │   ├── base.py         # Abstract PaymentProvider class
│   │   │   ├── paystack.py     # PaystackProvider implementation
│   │   │   └── registry.py     # Provider registry + get_provider()
│   │   └── webhook_router.py   # Webhook endpoints — signature verification first
│   ├── dispatch/
│   ├── tracking/
│   ├── notification/
│   ├── vendor/
│   ├── qa/
│   ├── analytics/
│   ├── dispute/
│   └── admin/
├── models/
│   └── base.py                 # Shared SQLAlchemy base + common columns
├── workers/
│   ├── celery_app.py           # Celery app instance
│   ├── tasks/
│   │   ├── escrow.py           # Escrow release tasks
│   │   ├── notifications.py    # Async notification dispatch
│   │   └── cleanup.py          # Housekeeping tasks
│   └── beat_schedule.py        # Celery Beat schedule (escrow timer, etc.)
├── migrations/
│   └── versions/               # Alembic migration files
├── tests/
│   ├── conftest.py
│   └── services/               # One test file per service
├── pyproject.toml              # uv project config
└── alembic.ini
```

### Service Boundary Rule

**No service imports from another service's internal modules.**
Cross-service calls go through defined service interfaces only.
This is the boundary that enables future microservice extraction.

```python
# CORRECT: Order service calls payment service through its public interface
from services.payment.service import PaymentService

# WRONG: Order service imports payment models directly
from services.payment.models import EscrowTransaction  # never do this
```

### Authentication Flow

1. Client POSTs credentials to `/auth/login`
2. FastAPI validates, issues JWT + refresh token
3. Both tokens set as httpOnly cookies in the response:
   - `avdan_token`: JWT, 15-minute expiry
   - `avdan_refresh_token`: Refresh token, 7-day expiry, rotated on use
4. All subsequent requests include cookies automatically
5. FastAPI dependency `get_current_user` decodes the JWT from the cookie
6. On 401, proxy.ts silently calls `/auth/refresh` and retries once

### Payment Provider Abstraction

```python
# services/payment/providers/base.py
from abc import ABC, abstractmethod

class PaymentProvider(ABC):
    @abstractmethod
    async def initiate_charge(self, order_id: str, amount: int, customer_email: str) -> ChargeResult: ...
    @abstractmethod
    async def verify_payment(self, reference: str) -> PaymentStatus: ...
    @abstractmethod
    async def transfer_to_vendor(self, vendor_id: str, amount: int, reference: str) -> TransferResult: ...
    @abstractmethod
    async def refund(self, payment_ref: str, amount: int) -> RefundResult: ...
    @abstractmethod
    async def verify_webhook(self, payload: bytes, signature: str, headers: dict) -> WebhookEvent: ...
```

**To add a new provider (e.g. Flutterwave):**
1. Create `services/payment/providers/flutterwave.py` implementing `PaymentProvider`
2. Register it in `services/payment/providers/registry.py`
3. Zero changes to Order Service, Escrow logic, or any other service

### Order State Machine (17 States)

```
PENDING → PAID → VENDOR_ACCEPTED → PREPARING → READY_FOR_PICKUP
       → VENDOR_REJECTED → REFUND_INITIATED
       → CANCELLED → REFUND_INITIATED

READY_FOR_PICKUP → PICKED_UP → IN_TRANSIT_TO_HUB → AT_HUB
→ QA_IN_PROGRESS → QA_PASSED → OUT_FOR_DELIVERY → DELIVERED
                 → QA_FAILED → VENDOR_REMEDIATION

DELIVERED → PAYMENT_RELEASE_PENDING → PAYMENT_RELEASED → COMPLETED
DELIVERED → DISPUTED → DISPUTE_RESOLVED → PAYMENT_RELEASED or REFUND_INITIATED
OUT_FOR_DELIVERY → FAILED_DELIVERY
```

**Rules:**
- Only the Order Service may write to `orders.status`
- Every transition creates a row in `order_events` (append-only, never delete)
- Every transition emits a notification event via the Notification Service

---

## Frontend Architecture

### Proxy (Auth Gate + API Proxy)

`proxy.ts` at the root of each Next.js app handles two concerns. In Next.js 16, `middleware.ts` was deprecated and renamed to `proxy.ts`. The exported function is `proxy()`, not `middleware()`. The runtime is now Node.js by default (previously Edge).

**1. Auth gate:**
```typescript
// Runs on Node.js runtime before any page renders (default in Next.js 16)
// Reads avdan_token httpOnly cookie
// Function exported as: export function proxy(request: NextRequest)
// Validates JWT locally (no API call)
// Redirects to /login if invalid
// Attaches user claims to request headers for server components
```

**2. API proxy:**
```typescript
// Rewrites /api/* → http://[API_INTERNAL_URL]/*
// Injects Authorization header from cookie
// Browser never sees the FastAPI URL
// Eliminates CORS configuration requirement
```

The proxy pattern means `API_INTERNAL_URL` (the real FastAPI address) is a server-side secret.
The browser only ever calls `/api/*` on its own domain.

### Tailwind v4 Configuration

Tailwind v4 uses CSS-first configuration. No `tailwind.config.js` file.

```css
/* styles/globals.css */
@import "tailwindcss";

@theme {
  /* Brand colors — swap hex before first deploy */
  --color-brand-50: #f0f9ff;      /* PLACEHOLDER */
  --color-brand-100: #e0f2fe;     /* PLACEHOLDER */
  --color-brand-500: #0ea5e9;     /* PLACEHOLDER — primary brand */
  --color-brand-600: #0284c7;     /* PLACEHOLDER — brand hover */
  --color-brand-900: #0c4a6e;     /* PLACEHOLDER */

  /* Semantic tokens */
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-border: #e2e8f0;
  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;
  --color-text-muted: #94a3b8;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;

  /* Spacing scale additions */
  --spacing-18: 4.5rem;
  --spacing-22: 5.5rem;
}
```

### Shadcn Setup

Shadcn components are installed per app via the shadcn CLI:
```bash
cd apps/web-customer
npx shadcn@latest init
npx shadcn@latest add button input card badge dialog ...
```

Shadcn writes components to `components/ui/` inside each app.
These are then wrapped in `packages/ui/` before use anywhere in modules or pages.

### TanStack Query + Zustand Boundary

**TanStack Query manages:** anything that comes from the API (orders, vendors, products, riders)
**Zustand manages:** client-only state (modal open/close, sidebar state, multi-step form progress, optimistic UI)

```typescript
// CORRECT split
const { data: orders } = useOrders()                   // TanStack Query
const { isCartOpen, toggleCart } = useCartStore()      // Zustand

// WRONG: server data in Zustand
const { orders } = useOrdersStore()                    // never do this
```

### SEO Strategy

Only `web-customer` requires SEO attention. All other apps are fully auth-gated.

```typescript
// app/(public)/vendors/[slug]/page.tsx — fully server rendered
export async function generateMetadata({ params }) {
  const vendor = await getVendor(params.slug)  // server-side fetch
  return {
    title: `${vendor.name} — Order on AVDAN`,
    description: vendor.description,
    openGraph: { images: [vendor.logo_url] }
  }
}

// Vendor discovery pages are Server Components by default
// Only the order tracking map and real-time updates use Client Components
```

---

## Database Schema

### Core Tables

```sql
-- users: all actors (polymorphic by role)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(20) NOT NULL,  -- customer, vendor, rider, agent, admin, support
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- orders: the central entity
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  rider_id UUID REFERENCES riders(id),
  hub_id UUID REFERENCES agent_hubs(id),
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  total_kobo INTEGER NOT NULL,  -- always in kobo, never float
  delivery_address JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- order_events: immutable state log (never update or delete)
CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  from_state VARCHAR(40),
  to_state VARCHAR(40) NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(20),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- escrow_transactions: provider-agnostic payment records
CREATE TABLE escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  provider VARCHAR(30) NOT NULL,           -- 'paystack', 'flutterwave', 'stripe'
  provider_ref VARCHAR(100) NOT NULL,      -- provider's transaction ID (idempotency key)
  provider_metadata JSONB,                 -- provider-specific fields, no schema changes needed
  amount_kobo INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'HELD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_ref)           -- prevents double-processing
);

-- rider_locations: time-series, partitioned by day
CREATE TABLE rider_locations (
  id UUID DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES riders(id),
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (recorded_at);
-- Auto-purge partitions older than 90 days via Celery Beat task
```

### Key Design Rules

- All monetary values in **kobo** (integers). Never FLOAT or DECIMAL for money.
- `order_events` is append-only. No UPDATE or DELETE ever.
- `escrow_transactions` has a UNIQUE constraint on `(provider, provider_ref)` — prevents double-processing webhooks.
- `rider_locations` is partitioned by day for performance. Auto-purged after 90 days.
- JSONB columns (`provider_metadata`, `delivery_address`, `metadata`) hold variable structure without schema migrations.

### Connection Pooling

```
Max connections formula: pool_size = floor(max_connections / (pods × workers)) − 5
MVP: floor(100 / (4 pods × 2 workers)) − 5 = floor(100/8) − 5 = 7 connections per worker
```

Configure in SQLAlchemy: `create_async_engine(DATABASE_URL, pool_size=7, max_overflow=2)`

---

## WebSocket Architecture

### Channels

| Channel | Publisher | Subscribers | Events |
|---------|-----------|-------------|--------|
| `order:{order_id}` | Order Service | Customer, Vendor, Admin | State changes |
| `rider:{rider_id}` | Rider App | Order Service, Customer | GPS, availability |
| `hub:{hub_id}` | Hub Portal | Dispatch Service, Admin | Throughput, alerts |

### Implementation

FastAPI native WebSockets + Redis Pub/Sub.
WebSocket connections are managed in the Tracking Service module.
Redis Pub/Sub bridges messages between server instances (when multiple API pods run).

```
Rider App → POST /tracking/location (every 5 seconds when on active order)
          → Tracking Service writes to Redis Pub/Sub
          → All WebSocket connections subscribed to order:{id} receive update
          → Customer App map updates in real-time
```

---

## CI/CD Pipeline

```
git push to develop → GitHub Actions
  1. pnpm install (cached)
  2. turbo run lint type-check test --filter=[HEAD^1]
  3. turbo run build --filter=[HEAD^1]
  4. docker build affected apps → tag with git SHA
  5. docker push ghcr.io/avdan/<app>:<sha>
  6. kubectl set image ... -n avdan-staging
  7. kubectl rollout status -n avdan-staging
  8. Notify on success/failure

git push to main (PR merged) → same pipeline → deploys to avdan-app namespace
```

**Image tagging:** Always `ghcr.io/avdan/<app>:<git-sha>`. Never `latest`.
**Rollback:** `kubectl set image deployment/<app> <app>=ghcr.io/avdan/<app>:<previous-sha>`

---

## Secrets Management

### Development
- Copy `.env.example` to `.env` (backend) and `.env.local` (frontend)
- Fill in your values
- Never commit `.env` or `.env.local`

### Production
- CI pipeline secrets stored in GitHub Secrets (KUBECONFIG, GHCR_TOKEN)
- App secrets stored as Sealed Secrets in `infra/k8s/sealed-secrets/`
- Sealed Secrets encrypted with cluster public key — safe to commit

```bash
# Sealing a new secret
kubectl create secret generic avdan-api --from-literal=KEY=VALUE \
  --dry-run=client -o yaml | kubeseal -o yaml > infra/k8s/sealed-secrets/api.yaml
```

---

## Scaling Path

### Phase 1 (current): MVP — ~$30/month
- Modular monolith FastAPI
- 4 replicas, 2 nodes
- PostgreSQL single instance
- Redis + Sentinel

### Phase 2: Growth (10K–100K orders/month)
- Extract Tracking Service (WebSocket-heavy, different scaling profile)
- Extract Notification Service (I/O-bound)
- Add Node 4 for WebSocket pods
- PostgreSQL read replica for analytics
- Redis Cluster mode
- HPA: auto-scale API pods 4–12

### Phase 3: Scale (100K+)
- Full microservice extraction per service boundary map
- Kafka replaces Redis Pub/Sub
- TimescaleDB for rider_locations
- Analytics data warehouse
- Multi-zone K8s

---

## Package Versions (Pin These)

```
# Backend (pyproject.toml)
fastapi = "^0.115"
sqlalchemy = "^2.0"
alembic = "^1.14"
pydantic = "^2.10"
pydantic-settings = "^2.7"
celery = "^5.4"
redis = "^5.2"
asyncpg = "^0.30"
PyJWT = "^2.10"
uvicorn = {extras = ["standard"], version = "^0.34"}
gunicorn = "^23"

# Frontend (package.json)
next = "16.x"
react = "19.x"
typescript = "^5.7"
tailwindcss = "^4.0"
@tanstack/react-query = "^5.x"
zustand = "^5.x"
react-hook-form = "^7.x"
zod = "^3.x"
sonner = "^1.x"
```

---

## What Intentionally Does Not Exist Yet

- `apps/app-rider/` — Native mobile app, future phase. `apps/web-rider/` is the current web-first implementation.
- Kafka — Phase 3, use Redis Pub/Sub now
- TimescaleDB — Phase 3, use partitioned PostgreSQL now
- Service mesh — Phase 3
- Analytics data warehouse — Phase 3
- Multi-zone K8s — Phase 3
