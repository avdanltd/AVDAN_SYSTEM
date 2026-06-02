# CLAUDE.md — AVDAN Agent Instructions

> This file is the primary instruction set for any AI agent working on this codebase.
> Read this file completely before touching any code. No assumptions. No shortcuts.
> When in doubt, re-read this file and ask rather than guess.

---

## What Is AVDAN?

AVDAN is a multi-role logistics and commerce platform connecting Customers, Vendors, Riders, Agent Hubs, and Administrators. It manages the full order lifecycle from purchase through escrow payment release.

Full architecture detail is in `ARCHITECTURE.md`. Read it before building anything.

---

## Monorepo Structure

```
avdan/
├── apps/
│   ├── api/                    # FastAPI backend (Python 3.12 + uv)
│   ├── web-customer/           # Next.js 16 — customer-facing app
│   ├── web-vendor/             # Next.js 16 — vendor dashboard
│   ├── web-admin/              # Next.js 16 — admin panel
│   └── web-hub/                # Next.js 16 — agent hub portal
├── packages/
│   ├── types/                  # @avdan/types — generated + hand-written TS types
│   ├── ui/                     # @avdan/ui — shared component library
│   └── config/                 # @avdan/config — ESLint, Prettier, tsconfig base
├── infra/
│   ├── docker/                 # Dockerfiles per service
│   ├── k8s/                    # Kubernetes manifests
│   └── nginx/                  # Nginx config
├── scripts/
│   ├── generate-types.sh       # Regenerates @avdan/types from FastAPI OpenAPI spec
│   └── dev.sh                  # Starts all services concurrently (native mode)
├── docker-compose.dev.yml      # Local Docker dev (with hot reload)
├── docker-compose.infra.yml    # Local infra only (postgres + redis, no apps)
├── turbo.json
└── pnpm-workspace.yaml
```

The rider mobile app (`app-rider`) is **Phase 4** and is NOT scaffolded in the initial build.
Do not create it. Do not reference it in code. Add it when `STATUS_FRONTEND.md` Phase 4 begins.

---

## Tech Stack — Do Not Deviate

### Backend
| Item | Value |
|------|-------|
| Language | Python 3.12 |
| Package manager | `uv` (never pip, never poetry) |
| Framework | FastAPI |
| ORM | SQLAlchemy 2.0 async + Alembic |
| Validation | Pydantic v2 |
| Task queue | Celery + Redis broker |
| Task scheduler | Celery Beat (single instance only) |
| Real-time | FastAPI native WebSockets + Redis Pub/Sub |
| Process manager | Gunicorn + Uvicorn workers (production) |
| Auth | JWT via PyJWT, stored as httpOnly cookie |

### Frontend (all Next.js apps)
| Item | Value |
|------|-------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 (CSS-first config, no tailwind.config.js) |
| Component base | Shadcn/ui (built upon, not used raw) |
| State — server | TanStack Query v5 |
| State — client | Zustand v5 |
| Forms | React Hook Form + Zod via zodResolver |
| HTTP client | Custom base client in `lib/api-client.ts` |
| Notifications | Sonner (toast) |
| Types | Imported from `@avdan/types` — never hand-written |

### Infrastructure
| Item | Value |
|------|-------|
| Orchestration | K3s (Kubernetes) |
| CI/CD | GitHub Actions |
| Container registry | GHCR (ghcr.io/avdan/*) |
| Servers | Contabo VPS (see ARCHITECTURE.md) |
| Domain | avdanstore.com |
| CDN | Cloudflare |
| Secrets | Sealed Secrets (cluster) + GitHub Secrets (CI) |

---

## Critical Rules — These Are Non-Negotiable

### General
- **Read ARCHITECTURE.md and STATUS files before every task.** Mark milestones as complete only when the milestone is fully working, not when code is written.
- **No assumptions.** If a requirement is unclear, stop and state what is unclear. Do not guess and build.
- **No placeholders in logic.** Placeholder UI text is fine. Placeholder business logic is not.
- **One milestone at a time.** Complete and verify the current milestone before moving to the next.
- **Every file you create must serve a purpose defined in this document or ARCHITECTURE.md.** Do not create extra files, helpers, or abstractions not specified.

### TypeScript
- Strict mode is always on. No `any`. No `// @ts-ignore`.
- All API response types come from `@avdan/types`. If the type does not exist there, run `scripts/generate-types.sh` and regenerate.
- Zod schemas for forms are derived from generated types, not written independently.

### Next.js App Router
- **`app/` directory contains routing only.** No business logic, no data fetching, no component definitions beyond the page shell.
- **All real code lives in `modules/`.** See the module structure section below.
- **Server Components are the default.** Only add `'use client'` when you need browser APIs, event handlers, or React state. If you are adding `'use client'` to a component that only displays data, you are doing it wrong.
- **Auth is handled in `proxy.ts` only.** No per-page auth checks. No `useEffect` redirect logic. No `if (!user) return null` patterns in pages.
- **Protected routes never flash.** If a user sees a protected page for even one frame before redirect, the auth implementation is wrong.

### API Client Rules
- The base client (`lib/api-client.ts`) is the only thing that calls `fetch`. Nothing else.
- Services (`modules/*/services/*.service.ts`) call the base client. They contain zero React.
- Hooks (`modules/*/hooks/use-*.ts`) wrap services with TanStack Query. They contain zero fetch logic.
- This three-layer boundary is strict. Breaking it is not acceptable.

### Styling Rules
- Tailwind v4: config lives in `globals.css` using `@theme {}` block, not in `tailwind.config.js`.
- Brand color token: `--color-brand` (placeholder — swap hex value before first deploy).
- All custom reusable components live in `packages/ui/`. App-specific non-reusable components live in `modules/*/components/`.
- Shadcn components are wrapped before use. Never use a Shadcn component directly in a page or module — always via a wrapper in `@avdan/ui` or the module's own `components/` folder.
- Design intent: modern, light-themed. Customer app = polished consumer feel. Admin/Vendor/Hub = clean utilitarian data density. They share the same design tokens but have different component compositions.

### Backend Rules
- All monetary values are stored and transmitted as integers in kobo (smallest NGN unit). Never floats.
- All state transitions go through the Order Service. No other service writes order state directly.
- `order_events` is append-only. Never update or delete rows.
- The Payment Service always uses the provider abstraction. Never call Paystack SDK directly from outside the Payment Service.
- Every Paystack webhook endpoint verifies `x-paystack-signature` before processing. No exceptions.
- Celery Beat runs as exactly one replica. This is enforced by K8s PodDisruptionBudget.

---

## Module Structure (All Next.js Apps)

Every Next.js app follows this exact structure:

```
apps/web-{name}/
├── app/                            # Routing only
│   ├── (auth)/                     # Unauthenticated route group
│   │   ├── login/
│   │   │   └── page.tsx            # Renders <LoginPage /> from modules/auth
│   │   └── register/
│   │       └── page.tsx
│   ├── (main)/                     # Authenticated route group
│   │   ├── layout.tsx              # Authenticated layout shell
│   │   └── [feature]/
│   │       └── page.tsx            # Renders <FeaturePage /> from modules/
│   ├── layout.tsx                  # Root layout (providers, fonts, global styles)
│   └── proxy.ts                   # Auth gate + API proxy — single source of truth
├── modules/
│   ├── auth/
│   │   ├── components/             # LoginForm, RegisterForm, OtpInput
│   │   ├── hooks/                  # use-login.ts, use-register.ts, use-session.ts
│   │   ├── services/               # auth.service.ts (raw API calls only)
│   │   ├── store/                  # auth.store.ts (Zustand — client session state)
│   │   └── schemas/                # auth.schemas.ts (Zod — derived from @avdan/types)
│   └── [feature]/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── schemas/
├── components/
│   ├── layout/                     # AppShell, Sidebar, Navbar, PageHeader
│   └── common/                     # ErrorBoundary, EmptyState, PageLoader
├── lib/
│   ├── api-client.ts               # Base HTTP client
│   ├── ws-client.ts                # WebSocket client
│   └── query-client.ts             # TanStack Query configuration
├── config/
│   └── routes.ts                   # All route strings as typed constants
├── types/
│   └── index.ts                    # App-specific types (not API types — those are @avdan/types)
└── styles/
    └── globals.css                 # Tailwind v4 @theme config + global styles
```

**Page files are thin wrappers.** A page file looks like this:

```tsx
// app/(main)/orders/page.tsx
import { OrdersPage } from '@/modules/orders/components/orders-page'

export default function Page() {
  return <OrdersPage />
}
```

All the real component code is in `modules/orders/components/orders-page.tsx`.
This separation means pages can be reorganised (URL changes) without touching component code.

---

## Auth Architecture — How It Works

### JWT Storage
- Backend issues JWT as an **httpOnly, Secure, SameSite=Lax cookie** named `avdan_token`.
- Never stored in localStorage. Never readable by JavaScript. Automatically sent with every request.
- Refresh token stored the same way as `avdan_refresh_token`.

### Middleware Flow
```
Every request → proxy.ts (Node.js runtime — default in Next.js 16, not Edge)
  1. Read `avdan_token` cookie
  2. Decode JWT locally (no DB call, no API call)
  3. Check expiry
  4. If expired → attempt silent refresh via /api/auth/refresh
  5. If refresh succeeds → set new cookie, continue
  6. If refresh fails → clear cookies, redirect to /login
  7. If valid → attach decoded claims to request headers (x-user-id, x-user-role)
  8. Page renders on server with user identity already available via headers
```

### Route Protection
```typescript
// proxy.ts — this is the ONLY place route protection happens
export const config = {
  matcher: ['/((?!login|register|_next|favicon|api/auth).*)'],
}
```

All routes except auth pages and public API routes are protected by default.
Adding a new protected route requires zero code change — the matcher handles it.

### API Proxy
All browser API calls go to `/api/` on the Next.js domain. Middleware rewrites to the FastAPI backend. The FastAPI URL (`https://api.avdanstore.com`) is never exposed to the browser.

```typescript
// proxy.ts handles rewrites:
// /api/orders → https://api.avdanstore.com/orders (with auth headers injected)
```

---

## Base API Client

```typescript
// lib/api-client.ts
// This is the ONLY file that calls fetch. Everything else calls this.

class ApiClient {
  private baseUrl: string  // /api (proxied through Next.js proxy — proxy.ts)

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T>
  async post<T>(endpoint: string, body: unknown): Promise<T>
  async postMultipart<T>(endpoint: string, data: FormData): Promise<T>
  async patch<T>(endpoint: string, body: unknown): Promise<T>
  async put<T>(endpoint: string, body: unknown): Promise<T>
  async delete<T>(endpoint: string): Promise<T>

  // Handles:
  // - JSON content type for standard requests
  // - multipart/form-data for file uploads (no Content-Type header set — browser sets boundary)
  // - 401 response → triggers token refresh → retries once → redirects to login if still 401
  // - Non-2xx responses → throws ApiError with status, code, and message from backend
}

export const apiClient = new ApiClient()
```

---

## Environment Variables

### Backend (`apps/api/.env`)
```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/avdan
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=<jwt-secret-min-32-chars>
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
ENVIRONMENT=development
FRONTEND_URLS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
```

### Frontend (`apps/web-{name}/.env.local`)
```
NEXT_PUBLIC_APP_NAME=AVDAN
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
API_INTERNAL_URL=http://localhost:8000
# API_INTERNAL_URL is server-side only (not NEXT_PUBLIC_)
# Browser calls /api/* which proxy.ts proxies to API_INTERNAL_URL
```

---

## Run Modes

### Mode 1: Local Native (fastest iteration)
```bash
# Terminal 1: Start infra (postgres + redis only)
docker compose -f docker-compose.infra.yml up

# Terminal 2: Start all apps concurrently
pnpm dev  # runs turbo run dev across all apps

# Or start a single app:
turbo run dev --filter=web-customer
turbo run dev --filter=api
```

### Mode 2: Local Docker Dev (full Docker, hot reload)
```bash
docker compose -f docker-compose.dev.yml up
# All apps with volume mounts for hot reload
# FastAPI: uvicorn with --reload
# Next.js: next dev inside container
```

### Mode 3: Server Development (develop branch)
```bash
# Automatic — push to develop branch
# GitHub Actions deploys to avdan-staging namespace on K3s cluster
# Accessible at staging.avdanstore.com, staging-vendor.avdanstore.com, etc.
```

### Mode 4: Server Production (main branch)
```bash
# Automatic — PR merged to main
# GitHub Actions deploys to avdan-app namespace on K3s cluster
# Accessible at avdanstore.com, vendor.avdanstore.com, etc.
```

### Local Database Options
**Option A (Recommended for dev):** Use Docker for just infra:
```bash
docker compose -f docker-compose.infra.yml up
# Starts postgres on localhost:5432 and redis on localhost:6379
```

**Option B:** Use a managed PostgreSQL service (Neon, Railway, Supabase):
```
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx.neon.tech/avdan?sslmode=require
```
Set this in `apps/api/.env`. Everything else stays the same.
Neon free tier: 0.5 GB storage, auto-suspend. Sufficient for development.

**Option C:** Local Redis only (PostgreSQL managed):
```bash
redis-server  # or: brew services start redis
# Set DATABASE_URL to your managed service URL
```

---

## Shared UI Package (`@avdan/ui`)

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── primitives/         # Shadcn wrappers (Button, Input, Card, Badge, etc.)
│   │   ├── forms/              # FormField, FormError, FormLabel (RHF-aware)
│   │   ├── feedback/           # Toast config (Sonner), Spinner, Skeleton
│   │   ├── layout/             # Container, Stack, Grid, Divider
│   │   └── data/               # DataTable, Pagination, EmptyState
│   ├── tokens/
│   │   └── tokens.css          # Design tokens (@theme variables, shared across apps)
│   └── index.ts                # Barrel export
└── package.json
```

**Primitives are thin wrappers.** Example:
```tsx
// packages/ui/src/components/primitives/button.tsx
import { Button as ShadcnButton } from '@/components/ui/button'  // shadcn
import { cn } from '@/lib/utils'

export const Button = ({ className, variant = 'default', ...props }) => (
  <ShadcnButton
    className={cn('font-medium tracking-tight', className)}
    variant={variant}
    {...props}
  />
)
```

When the Figma design arrives, you update the wrapper. Every app picks up the change automatically.

---

## Type Generation

Run this whenever FastAPI models change:

```bash
# FastAPI must be running on localhost:8000
bash scripts/generate-types.sh
```

This regenerates `packages/types/src/generated.ts`.
**Never edit `generated.ts` manually.**
The file is committed to git after generation so the frontend team can work without running the backend.

---

## Git Workflow

```
main          → production (avdanstore.com)
develop       → staging (staging.avdanstore.com)
feature/*     → PR to develop
hotfix/*      → PR directly to main (critical fixes only)
```

**Branch naming:**
- `feature/backend-auth-service`
- `feature/frontend-customer-order-flow`
- `hotfix/payment-webhook-signature`

**Commit style:** Conventional commits:
- `feat(auth): add JWT refresh endpoint`
- `fix(orders): correct state transition guard`
- `chore(deps): update tanstack query to 5.x`

**PR rules:**
- PR must reference a milestone from `STATUS_BACKEND.md` or `STATUS_FRONTEND.md`
- PR must include what was tested and how
- No self-merges — at minimum one review (even if team of two, the other person reviews)

---

## Figma-to-Rebuild Path

The codebase is structured so a full visual overhaul requires only:
1. Update design tokens in `packages/ui/src/tokens/tokens.css`
2. Update Shadcn wrapper components in `packages/ui/src/components/primitives/`
3. Update module-level layout components in `modules/*/components/`

The hooks, services, schemas, stores, and API client are **completely untouched** in a visual overhaul.
Logic and UI are separated at every level by design.

---

## What the Agent Must Never Do

- Never call `fetch` directly in a component or hook — always via `apiClient`
- Never store JWT or auth tokens in localStorage or sessionStorage
- Never add auth checks inside page components — proxy.ts handles this
- Never use `any` in TypeScript
- Never write Zod schemas that duplicate `@avdan/types` — derive from generated types
- Never run database migrations without confirming the migration is correct
- Never hardcode API URLs — always use environment variables
- Never commit `.env` files — only `.env.example` with placeholder values
- Never skip error handling — every API call must handle failure state
- Never use `useEffect` for data fetching — always TanStack Query
- Never mark a STATUS milestone as complete without the feature being fully working end-to-end
- Never create files outside the defined structure without a stated reason
- Never use `tailwind.config.js` — Tailwind v4 uses CSS-first config in `globals.css`
- Never use `next/router` — App Router uses `next/navigation`
- Never use Pages Router patterns in App Router code
