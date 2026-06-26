# STATUS_FRONTEND.md — Frontend Build Status

> Agent: Read CLAUDE.md and ARCHITECTURE.md before starting any phase.
> Mark milestones complete by changing `[ ]` to `[x]` only when fully working end-to-end.
> Do not start a frontend phase until the corresponding backend phase is complete.
> Current phase and active milestone must be stated at the top of every session.

---

## Current Status

**Active Phase:** Phase 7 — Admin Panel (code complete, pending live backend test)
**Last Completed:** Phase 6 — Hub Portal ✓ (2026-06-09)
**Blocking Issues:** None — all phases require live backend to verify end-to-end

---

## Dependency Map (Backend → Frontend)

| Frontend Phase | Requires Backend Phase Complete |
|---------------|---------------------------------|
| Phase 1 (scaffold) | Backend Phase 1 |
| Phase 2 (auth UI) | Backend Phase 2 |
| Phase 3 (vendor/catalog) | Backend Phase 3 |
| Phase 4 (order flow) | Backend Phase 4 + 5 |
| Phase 5 (tracking UI) | Backend Phase 6 |
| Phase 6 (hub portal) | Backend Phase 8 |
| Phase 7 (admin dashboard) | Backend Phase 10 |
| Phase 8 (mobile) | All backend phases complete |

---

## Phase 1 — Scaffold: Monorepo, Shared Packages, Base Apps ✓

### 1.1 Monorepo Foundation
- [x] `pnpm-workspace.yaml` correctly lists `apps/*` and `packages/*`
- [x] `turbo.json` pipeline defined: `dev`, `build`, `lint`, `type-check`, `test`
- [x] Root `package.json` has workspace scripts: `dev`, `build`, `lint`, `format`
- [x] `.npmrc` set: `shamefully-hoist=false`, `strict-peer-dependencies=false`
- [x] All `package.json` files use workspace protocol for internal deps: `"@avdan/types": "workspace:*"`
- [x] `pnpm install` runs cleanly from root with no errors
- [ ] `turbo run build` completes — not yet verified

### 1.2 @avdan/config Package
- [x] `packages/config/` created
- [x] `tsconfig.base.json` — strict mode, paths, `moduleResolution: bundler`
- [x] `eslint.config.mjs` — Next.js + TypeScript rules, import order, no-any enforced
- [x] `.prettierrc` — consistent formatting (single quotes, trailing commas, 100 char width)
- [x] Each Next.js app's `tsconfig.json` extends `@avdan/config/tsconfig.base.json`
- [ ] Each app's ESLint config extends `@avdan/config/eslint.config.mjs` — eslint.config.mjs not created per app yet

### 1.3 @avdan/types Package
- [x] `packages/types/src/generated.ts` — placeholder (empty export until `generate-types.sh` runs)
- [x] `packages/types/src/index.ts` — re-exports from generated + hand-written types (UserRole, OrderStatus, ApiError, etc.)
- [x] `packages/types/package.json` — exports `./src/index.ts` as main entry
- [ ] `scripts/generate-types.sh` verified — needs FastAPI running on localhost:8000
- [ ] Import verified in a test file: `import type { HealthResponse } from '@avdan/types'` resolves — not verified

### 1.4 @avdan/ui Package
- [x] `packages/ui/` created with Shadcn installed via CLI
- [x] `components.json` configured — Shadcn output to `src/components/ui/`
- [x] `packages/ui/src/tokens/tokens.css` — unified color system: `:root` Shadcn HSL vars + `@theme` Tailwind utilities
- [x] Color system: `--primary` = brand (#0ea5e9 placeholder), `--destructive` = error, `--muted` = surface
- [x] Fonts: Bricolage Grotesque (body, `--font-sans`) + Playfair Display (headings, `--font-display`)
- [x] **Shadcn primitives** installed: Button, Input, Label, Card, Badge, Dialog, DropdownMenu, Form, Separator, Skeleton, Avatar, Sheet, Select, Textarea, Tabs, Switch, Progress
- [x] **Full Shadcn Form system**: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`
- [x] **Custom components** in `src/components/custom/`:
  - [x] `OrderStatusBadge` / `UserStatusBadge` — all 23 order states mapped to correct badge colors
  - [x] `ConfirmDialog` — reusable confirm with `destructive` prop
  - [x] `DataTable<T>` — typed generic table with loading skeletons + empty state
  - [x] `EmptyState` — icon + title + description + action
  - [x] `PageLoader` — full-area spinner
  - [x] `StatsCard` — metric card with icon, value, subtitle, trend indicator, loading skeleton
  - [x] `Spinner` — accessible loading spinner (sm/md/lg)
- [x] `packages/ui/src/index.ts` barrel exports all Shadcn + custom components
- [ ] All components render correctly in browser — pending app startup verification

### 1.5 Next.js App Scaffold (All 4 Apps)
- [x] All 4 apps scaffolded (Next.js 16.2.7, App Router, TypeScript)
- [x] Shadcn lives in `packages/ui` — apps do NOT run Shadcn CLI directly
- [x] Each app installs: `@avdan/types`, `@avdan/ui`, `@avdan/config`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `zod`, `sonner`, `jose`, `lucide-react`
- [x] `styles/globals.css` — Tailwind v4 + `@source` for ui package + tokens import + heading fonts
- [x] `postcss.config.mjs` — `@tailwindcss/postcss` plugin configured in all 4 apps
- [x] `lib/api-client.ts` created in each app — only place that calls `fetch`
- [x] `lib/query-client.ts` created — TanStack Query client with staleTime, retry, error handling
- [x] `lib/ws-client.ts` created — WebSocket client with exponential backoff reconnect
- [x] `app/layout.tsx` — `QueryClientProvider`, `ToastProvider`, fonts
- [x] `config/routes.ts` created with typed route constants per app
- [x] `modules/auth/` scaffold complete in all 4 apps (service, store, hooks, schemas, forms)
- [x] `components/layout/` (AppShell, Sidebar with icons, Navbar) in all 4 apps
- [x] `components/common/` (PageLoader, ErrorBoundary) in all 4 apps
- [x] All 4 apps start concurrently via `turbo run dev` from root

### 1.6 Proxy Setup (All 4 Apps)
- [x] `proxy.ts` at root of each app — all 4 apps
- [x] `export function proxy(request: NextRequest)` — named export
- [x] JWT validation: reads `avdan_token` cookie, decodes locally via `jose`, checks expiry
- [x] Silent refresh: on expired token, calls `/api/auth/refresh`, retries with new token
- [x] Redirect to `/login` if refresh fails or token absent
- [x] API proxy: all `/api/*` requests rewritten to `process.env.API_INTERNAL_URL/*`
- [x] Auth header injected: `Authorization: Bearer {token}` added to proxied requests
- [x] Public routes excluded from auth gate
- [x] Matcher config set correctly
- [ ] Proxy verified live with backend — pending backend connectivity test

### 1.7 GitHub Actions CI
- [x] `.github/workflows/ci.yml` — on push to any branch: install, lint, type-check, build
- [x] `.github/workflows/deploy-staging.yml` — triggers on CI success for develop branch; SSH + Docker Compose deploy to VPS staging
- [x] `.github/workflows/deploy-prod.yml` — triggers on CI success for main branch; SSH + Docker Compose deploy to VPS production (environment approval gate)

**Phase 1 complete ✓ (code)** — pending live verification of proxy and build pipeline.

---

## Phase 2 — Auth UI (All Apps) ✓

### 2.1 Auth Module (All Apps)
- [x] `modules/auth/schemas/auth.schemas.ts` — Zod schemas for login, register forms
- [x] `modules/auth/services/auth.service.ts` — `login()`, `register()`, `logout()`, `getMe()` (zero React)
- [x] `modules/auth/store/auth.store.ts` — Zustand store: `user`, `isAuthenticated`, `setUser`, `clearUser`
- [x] `modules/auth/hooks/use-session.ts` — provides `isAuthenticated`, `user`, `role`
- [x] `modules/auth/hooks/use-login.ts` — TanStack Query mutation wrapping `auth.service.login`
- [x] `modules/auth/hooks/use-logout.ts` — mutation, clears store + calls logout endpoint

### 2.2 Login Page (All Apps)
- [x] `modules/auth/components/login-form.tsx` — RHF + Zod, email + password fields
- [x] Login form uses `@avdan/ui` primitives
- [x] Loading state, error toast on invalid credentials
- [x] On successful login: redirects to app home
- [x] `app/(auth)/login/page.tsx` — thin wrapper
- [x] Login page accessible without auth

### 2.3 Register Page (web-customer + web-vendor only)
- [x] `modules/auth/components/register-form.tsx` — name, email, phone, password, confirm password
- [x] `modules/auth/components/otp-form.tsx` — 6 individual digit inputs, auto-focus, paste support, resend countdown
- [x] Register flow: fill form → submit → OTP screen → verify → redirect to login
- [x] Vendor register: business name, business type, description additional fields
- [x] `app/(auth)/register/page.tsx` — thin wrapper

### 2.4 Authenticated Layout Shell (All Apps)
- [x] `app/(main)/layout.tsx` — authenticated layout with sidebar + main content area
- [x] `components/layout/sidebar.tsx` — desktop sidebar with icons + user profile footer
- [x] `components/layout/navbar.tsx` — top bar with user dropdown, mobile hamburger + Sheet
- [x] `components/layout/page-wrapper.tsx` — consistent page padding
- [x] Sidebar links from `config/routes.ts`
- [x] Active route highlighted in sidebar
- [x] Mobile: hamburger opens Sheet with full navigation

### 2.5 Session Hydration (All Apps)
- [x] Root `app/layout.tsx` fetches `GET /auth/me` server-side using `avdan_token` cookie
- [x] User passed to `Providers` → `SessionHydrate` client component initialises Zustand store
- [x] No auth-check flickering

**Phase 2 complete ✓ (code)** — pending live backend test (Backend Phase 2 is done).

---

## Phase 3 — Customer App: Vendor Discovery & Catalog ✓

### 3.1 Vendor Service + Hooks
- [x] `modules/vendors/types.ts` — Vendor, Product, VendorWithProducts interfaces
- [x] `modules/vendors/services/vendors.service.ts` — `getVendors()`, `getVendor(slug)`
- [x] `modules/vendors/hooks/use-vendors.ts` — TanStack Query with staleTime 30s
- [x] `modules/vendors/hooks/use-vendor.ts` — single vendor query

### 3.2 Vendor Components
- [x] `modules/vendors/components/vendor-card.tsx` — logo/avatar, name, description, star rating, status badge, hover effects
- [x] `modules/vendors/components/vendor-card-skeleton.tsx` — loading placeholder
- [x] `modules/vendors/components/vendor-grid.tsx` — responsive grid with skeleton/empty/error states
- [x] `modules/vendors/components/vendors-home-page.tsx` — hero + search bar + filtered vendor grid

### 3.3 Pages
- [x] `app/(main)/page.tsx` (home) — thin wrapper → VendorsHomePage
- [x] `app/(main)/vendors/[slug]/page.tsx` — Server Component with `generateMetadata()` for SEO
- [x] `modules/vendors/components/vendor-detail-page.tsx` — hero section + product grid + Add to Cart

### 3.4 Sidebar
- [x] `components/layout/sidebar.tsx` — updated with lucide icons (Home, ShoppingBag, Bell, User)

### 3.5 SEO
- [x] `app/sitemap.ts` — generates sitemap with vendor slugs
- [x] `app/robots.ts` — allows public routes, disallows auth-gated

**Phase 3 complete ✓ (code)** — requires Backend Phase 3 running.

---

## Phase 4 — Customer App: Cart, Checkout & Orders ✓

### 4.1 Cart
- [x] `modules/cart/store/cart.store.ts` — Zustand with persist middleware; single-vendor constraint; addItem, removeItem, updateQuantity, clearCart
- [x] `modules/cart/components/cart-drawer.tsx` — Sheet panel with quantity controls, remove, subtotal, checkout CTA
- [x] Cart item count badge in Navbar
- [x] Cross-vendor confirmation dialog: "Adding this will clear your current cart. Continue?"

### 4.2 Checkout
- [x] `modules/checkout/schemas/checkout.schemas.ts` — Zod schema for delivery address + phone
- [x] `modules/checkout/services/checkout.service.ts` — `createOrder()`, `initiatePayment()`
- [x] `modules/checkout/hooks/use-checkout.ts` — TanStack Query mutations
- [x] `modules/checkout/components/checkout-page.tsx` — split layout: delivery form + order summary
- [x] `app/(main)/checkout/page.tsx` — thin wrapper; empty cart redirects home
- [x] `app/(main)/checkout/success/page.tsx` — Paystack callback success page
- [x] `app/(main)/checkout/failed/page.tsx` — Paystack callback failure page
- [x] On submit: createOrder → initiatePayment → `window.location.href` to Paystack URL

### 4.3 Order History & Detail
- [x] `modules/orders/services/orders.service.ts` — `getOrders()`, `getOrder(id)`, `cancelOrder(id)`
- [x] `modules/orders/hooks/use-orders.ts`, `use-order.ts`, `use-cancel-order.ts`
- [x] `app/(main)/orders/page.tsx` — paginated order list with status badges
- [x] `modules/orders/components/orders-page.tsx` — DataTable with click-to-detail
- [x] `app/(main)/orders/[id]/page.tsx` — order detail
- [x] `modules/orders/components/order-detail-page.tsx` — items, timeline, cancel button (PENDING only), track link

### 4.4 Vendor Dashboard: Incoming Orders ✓ (web-vendor)
- [x] `modules/orders/services/orders.service.ts` — `getVendorOrders()`, `acceptOrder()`, `rejectOrder()`, `markReady()`
- [x] Hooks: `use-orders.ts` (refetchInterval: 30s), `use-accept-order.ts`, `use-reject-order.ts`, `use-mark-ready.ts`
- [x] `modules/orders/components/order-card.tsx` — status-aware action buttons, reject dialog with reason
- [x] `modules/orders/components/orders-page.tsx` — 4 tabs: New (with count badge) | Preparing | Ready | History
- [x] `app/(main)/orders/page.tsx` (web-vendor) — thin wrapper

### 4.5 Vendor Catalog (web-vendor) ✓
- [x] `modules/catalog/services/catalog.service.ts` — getVendorProfile, createProduct, updateProduct, toggleAvailability, deleteProduct
- [x] `modules/catalog/hooks/use-catalog.ts`, `use-create-product.ts`, `use-update-product.ts`, `use-toggle-availability.ts` (optimistic), `use-delete-product.ts`
- [x] `modules/catalog/components/product-form.tsx` — RHF + Zod, availability Switch
- [x] `modules/catalog/components/catalog-page.tsx` — card grid, availability toggle, edit/delete per card
- [x] `app/(main)/products/page.tsx` (web-vendor) — thin wrapper

**Phase 4 complete ✓ (code)** — requires Backend Phases 4 + 5 running.

---

## Phase 5 — Live Tracking UI ✓

### 5.1 WebSocket Client
- [x] `lib/ws-client.ts` — WsClient class, connect/disconnect/on, exponential backoff reconnect (1s → 30s max)

### 5.2 Tracking Hook
- [x] `modules/tracking/hooks/use-order-tracking.ts` — connects to `/ws/order/{orderId}`, handles location/status/eta/rider_info message types

### 5.3 Tracking Map
- [x] `modules/tracking/components/tracking-map.tsx` — react-leaflet MapContainer, OpenStreetMap tiles, custom SVG div icon (no webpack asset issues)
- [x] `leaflet` + `react-leaflet` + `@types/leaflet` installed in web-customer

### 5.4 Tracking Page
- [x] `app/(main)/orders/[id]/track/page.tsx` — thin wrapper
- [x] `modules/tracking/components/tracking-page.tsx` — dynamic import of map (ssr: false), live status banner, ETA, rider info

**Phase 5 complete ✓ (code)** — requires Backend Phase 6 running.

---

## Phase 6 — Agent Hub Portal ✓

### 6.1 Hub Dashboard
- [x] `modules/hub/types.ts` — HubOrder, HubStats, QaInspection interfaces
- [x] `modules/hub/services/hub.service.ts` — getStats, getInboundOrders, receiveOrder, qaPass, qaFail, uploadEvidence
- [x] `modules/hub/hooks/use-hub-stats.ts` — polls every 30s
- [x] `modules/hub/hooks/use-inbound-orders.ts` — polls every 15s (FIFO queue)
- [x] `modules/hub/hooks/use-hub-order.ts`, `use-receive-order.ts`, `use-qa-pass.ts`, `use-qa-fail.ts`, `use-upload-evidence.ts`
- [x] `modules/hub/components/dashboard-page.tsx` — 4 StatsCards + embedded OrderQueue
- [x] `app/(main)/page.tsx` (web-hub) — thin wrapper

### 6.2 Order Queue
- [x] `modules/hub/components/order-queue.tsx` — FIFO list with Receive / Start QA action buttons per status; AT_HUB orders highlighted amber

### 6.3 QA Workflow
- [x] `app/(main)/orders/[id]/qa/page.tsx` — thin wrapper
- [x] `modules/hub/components/qa-page.tsx` — items checklist, notes textarea (required for FAIL), photo evidence upload with previews, green PASS / red FAIL buttons with ConfirmDialogs
- [x] Evidence upload: immediate per-file upload via multipart, thumbnail previews
- [x] FAIL button disabled until notes filled

### 6.4 Orders + Analytics + Profile
- [x] `app/(main)/orders/page.tsx` — tabbed DataTable (Inbound / QA In Progress / Dispatched / All)
- [x] `app/(main)/analytics/page.tsx` — StatsCards + Progress bar for pass rate
- [x] `app/(main)/profile/page.tsx` — view/edit agent profile

**Phase 6 complete ✓ (code)** — requires Backend Phase 8 running.

---

## Phase 7 — Admin Panel ✓

### 7.1 Admin Dashboard
- [x] `modules/analytics/services/analytics.service.ts` — getOverview, getOrderVolume
- [x] `modules/analytics/hooks/use-platform-overview.ts` (refetchInterval: 30s), `use-order-volume.ts`
- [x] `modules/analytics/components/dashboard-page.tsx` — 4 StatsCards, recharts AreaChart (order volume), recharts BarChart (revenue), Pending Disputes card
- [x] `app/(main)/page.tsx` (web-admin) — thin wrapper

### 7.2 User Management
- [x] `modules/users/types.ts`, `services/users.service.ts`
- [x] `modules/users/hooks/use-users.ts`, `use-update-user-status.ts`, `use-create-admin.ts`
- [x] `modules/users/components/users-page.tsx` — DataTable with role/search filters, pagination, Activate/Suspend/Ban (Ban requires typed "CONFIRM")
- [x] `modules/users/components/create-admin-dialog.tsx` — RHF form for new admin/support account
- [x] `app/(main)/users/page.tsx` — thin wrapper

### 7.3 Order Management
- [x] `modules/orders/types.ts`, `services/orders.service.ts`
- [x] `modules/orders/hooks/use-admin-orders.ts`, `use-admin-order.ts`, `use-override-status.ts`
- [x] `modules/orders/components/orders-page.tsx` — full filter set (status, date, search)
- [x] `modules/orders/components/order-detail-page.tsx` — full timeline, all 23 status options, admin override (requires typed "CONFIRM")
- [x] `app/(main)/orders/page.tsx` + `app/(main)/orders/[id]/page.tsx` — thin wrappers

### 7.4 Vendor Management
- [x] `modules/vendors/types.ts`, `services/vendors.service.ts`
- [x] `modules/vendors/hooks/use-admin-vendors.ts`, `use-update-vendor-status.ts`
- [x] `modules/vendors/components/vendors-page.tsx` — default filter to pending, Approve/Suspend/Reject with reason dialogs
- [x] `app/(main)/vendors/page.tsx` — thin wrapper

### 7.5 Dispute Management
- [x] `modules/disputes/types.ts`, `services/disputes.service.ts`
- [x] `modules/disputes/hooks/use-admin-disputes.ts`, `use-admin-dispute.ts`, `use-resolve-dispute.ts`
- [x] `modules/disputes/components/disputes-page.tsx` — tabbed Open/Resolved
- [x] `modules/disputes/components/dispute-detail-page.tsx` — evidence thumbnails, resolution form with split%, typed "CONFIRM"
- [x] `app/(main)/disputes/page.tsx` + `app/(main)/disputes/[id]/page.tsx` — thin wrappers

### 7.6 Escrow Overview
- [x] `modules/escrow/types.ts`, `services/escrow.service.ts`, `hooks/use-escrow-orders.ts`
- [x] `modules/escrow/components/escrow-page.tsx` — age-colored rows (green/amber/red), stats cards, readonly display
- [x] `app/(main)/escrow/page.tsx` — thin wrapper

### 7.7 Platform Config
- [x] `modules/config/types.ts`, `services/config.service.ts`, `hooks/use-platform-config.ts`, `use-update-config.ts`
- [x] `modules/config/components/config-page.tsx` — commission/delivery fee edit form, audit log
- [x] `app/(main)/config/page.tsx` — thin wrapper

### 7.8 Analytics Page
- [x] `modules/analytics/components/analytics-page.tsx` — period selector (7d/30d/90d), full recharts charts
- [x] `app/(main)/analytics/page.tsx` — thin wrapper

### 7.9 Dispatch Management (prerequisite for Rider app)
- [x] `modules/dispatch/types.ts` — DispatchOrder, AvailableRider, AssignRiderResponse
- [x] `modules/dispatch/services/dispatch.service.ts` — getReadyOrders, getPickedUpOrders, getInTransitOrders, getAvailableRiders, assignRider
- [x] `modules/dispatch/hooks/use-dispatch.ts` — useReadyOrders (20s poll), useAvailableRiders (15s poll), useAssignRider
- [x] `modules/dispatch/components/dispatch-page.tsx` — 3-tab layout (Ready/PickedUp/ToHub) + live riders panel
- [x] `app/(main)/dispatch/page.tsx` — thin wrapper
- [x] Sidebar: Dispatch nav item added (Truck icon)
- [x] Routes: `ROUTES.dispatch` added

**Phase 7 complete ✓ (code)** — requires Backend Phase 10 running.

---

## Phase 8 — Rider Mobile App (React Native + Expo)

> Start this phase only after: Dispatch UI is in admin panel, all TEST_CASES.md bugs are resolved,
> and the full order lifecycle (order → pay → accept → ready → assign rider → hub QA → deliver → escrow release)
> has been walked through end-to-end manually.

### Platform Decision
- **Framework:** Expo (managed workflow) + EAS Build for `.apk` / `.ipa` output
- **NOT** a web wrapper — this is a proper native app
- **Target:** Android 10+ and iOS 15+
- Customer app (web-customer) will also move to React Native in a future phase — the module/hook/service layer is already portable

### Architecture (same pattern as web apps)
- `modules/auth/` — reuse same service/hook/schema logic; only swap UI components
- `modules/orders/` — assigned orders list + action buttons
- `modules/tracking/` — GPS broadcast, background location
- `lib/api-client.ts` — same base client (fetch works in React Native)
- Zustand store — works identically in React Native
- TanStack Query — works identically in React Native
- Zod schemas — works identically in React Native

### iOS-Specific Requirements (must be declared before first TestFlight submission)
- Background location: declare `location` in `app.json` `infoPlist.UIBackgroundModes`
- Usage strings required (or App Store Review rejects):
  - `NSLocationWhenInUseUsageDescription`
  - `NSLocationAlwaysAndWhenInUseUsageDescription`
  - `NSCameraUsageDescription` (for delivery proof photo)
- Payment flows: AVDAN handles physical goods — NOT subject to Apple IAP rules. Checkout stays on web-customer. Rider app never touches money, so no IAP issue.
- Push notifications: configure APNs key in EAS + Expo Notifications (wraps APNs uniformly)
- Background task for location: use `expo-task-manager` + `expo-location` `startLocationUpdatesAsync` — iOS kills plain `setInterval` when backgrounded

### Android-Specific Requirements
- Background location: `ACCESS_BACKGROUND_LOCATION` permission (Android 10+) — must be requested separately after `ACCESS_FINE_LOCATION`; user must grant explicitly via system settings dialog
- Foreground service: required to keep location alive when app is minimised — declare `FOREGROUND_SERVICE` permission + `expo-location` handles the persistent notification automatically
- Push notifications: FCM via Expo Notifications — same token flow as web (backend already has FCM integration)

### Rider App Screen Map
```
(auth)
  /login               → RHF login form, same credentials as other apps
(main)
  /                    → Active order card (if assigned) + Go Online toggle
  /orders              → List of assigned orders by status
  /orders/[id]         → Order detail: items, pickup address, delivery address
  /orders/[id]/pickup  → Confirm pickup screen (big button → PICKED_UP)
  /orders/[id]/transit → Mark in transit to hub (IN_TRANSIT_TO_HUB)
  /orders/[id]/deliver → Confirm delivery + optional photo proof (DELIVERED / FAILED_DELIVERY)
```

### State Transitions the Rider Controls
```
READY_FOR_PICKUP  → PICKED_UP          (rider confirms pickup)
PICKED_UP         → IN_TRANSIT_TO_HUB  (rider marks en route to hub)
QA_PASSED         → OUT_FOR_DELIVERY   (rider/agent dispatches last mile)
OUT_FOR_DELIVERY  → DELIVERED          (rider confirms delivery)
OUT_FOR_DELIVERY  → FAILED_DELIVERY    (rider reports failed attempt)
```

### Backend Endpoints the Rider App Uses (all already built)
| Endpoint | Purpose |
|----------|---------|
| `POST /auth/login` | Auth |
| `GET /auth/me` | Session |
| `POST /dispatch/me/availability` | Toggle online/offline |
| `POST /dispatch/me/location` | Broadcast GPS every 5s |
| `GET /orders` | Rider's assigned orders (needs rider-scoped filter — add to Phase 8) |
| `POST /orders/{id}/pickup` | PICKED_UP transition (add endpoint in Phase 8) |
| `POST /orders/{id}/transit` | IN_TRANSIT_TO_HUB (add endpoint in Phase 8) |
| `POST /orders/{id}/deliver` | DELIVERED + photo (add endpoint in Phase 8) |
| `POST /orders/{id}/fail-delivery` | FAILED_DELIVERY (add endpoint in Phase 8) |

### Missing Backend Work (do in Phase 8 before building screens)
- Rider-scoped order list endpoint (`GET /orders` currently only covers customers)
- Rider state transition endpoints (pickup, transit, deliver, fail-delivery) — state machine already has these transitions, just need the HTTP endpoints
- These are small additions to `services/orders/router.py`

### Milestones
- [ ] 8.1 Expo project scaffolded (`app-rider/`) with EAS config, all permissions declared
- [ ] 8.2 Auth flow complete (login, session hydration, logout)
- [ ] 8.3 Go Online toggle + GPS broadcast running (foreground + background)
- [ ] 8.4 Assigned order list + order detail screens
- [ ] 8.5 Pickup → Hub Transit flow with state transitions
- [ ] 8.6 Last-mile delivery flow (OUT_FOR_DELIVERY → DELIVERED / FAILED_DELIVERY)
- [ ] 8.7 Push notifications working (FCM Android + APNs iOS)
- [ ] 8.8 EAS Build produces working `.apk` (Android) and `.ipa` (iOS) — tested on real devices

---

## Design Rules for All Apps

### Customer App (web-customer) ✓ Applied
- Consumer-grade polish. Mobile-first. Large images, generous whitespace.
- Brand color prominent on CTAs.
- SEO-optimised public pages (vendor detail is Server Component with generateMetadata).

### Vendor Dashboard (web-vendor) ✓ Applied
- Productivity-focused. Dense but clear.
- 30s polling on incoming orders tab with count badge.
- New order tab has order count displayed.

### Admin Panel (web-admin) ✓ Applied
- Data-dense. Tables with filters and pagination.
- Destructive actions require ConfirmDialog; critical actions require typed "CONFIRM".
- recharts charts on dashboard and analytics pages.

### Agent Hub Portal (web-hub) ✓ Applied
- Functional and fast. Large touch targets (py-2.5 on nav items).
- QA workflow completable in minimum clicks.
- Green PASS / red FAIL visual distinction.
- 15s polling on inbound queue.

---

## Notes for Agent

- Phases 2–7 are code-complete as of 2026-06-09. All require live backend verification.
- When starting a session, run `pnpm turbo run type-check` to check all apps before touching code.
- `generate-types.sh` must be run once the backend is live to regenerate `@avdan/types/generated.ts`.
- All apps pass TypeScript strict mode checks as of 2026-06-09.
- Brand color placeholder: `--primary: 199 89% 48%` (#0ea5e9). Change `:root { --primary: ... }` in `packages/ui/src/tokens/tokens.css` to rebrand.
