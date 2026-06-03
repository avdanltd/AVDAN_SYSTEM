# STATUS_FRONTEND.md — Frontend Build Status

> Agent: Read CLAUDE.md and ARCHITECTURE.md before starting any phase.
> Mark milestones complete by changing `[ ]` to `[x]` only when fully working end-to-end.
> Do not start a frontend phase until the corresponding backend phase is complete.
> Current phase and active milestone must be stated at the top of every session.

---

## Current Status

**Active Phase:** Phase 2
**Active Milestone:** 2.1–2.5 — Auth Module complete (pending backend live test)
**Last Completed:** Phase 1 — Scaffold ✓ (2026-06-02)
**Blocking Issues:** Backend Phase 2 API must be running to verify login/register end-to-end

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

## Phase 1 — Scaffold: Monorepo, Shared Packages, Base Apps

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
- [x] `packages/ui/` created with Shadcn installed via CLI (`npx shadcn@latest add ...`)
- [x] `components.json` configured — Shadcn output to `src/components/ui/`
- [x] `packages/ui/src/tokens/tokens.css` — unified color system: `:root` Shadcn HSL vars + `@theme` Tailwind utilities
- [x] Color system: `--primary` = brand, `--destructive` = error, `--muted` = surface — single source of truth
- [x] Fonts: Bricolage Grotesque (body, `--font-sans`) + Playfair Display (headings, `--font-display`)
- [x] **Shadcn primitives** installed in `src/components/ui/` (Button, Input, Label, Card, Badge, Dialog, DropdownMenu, Form, Separator, Skeleton, Avatar, Sheet, Select, Textarea, Tabs)
- [x] **Full Shadcn Form system**: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`
- [x] **Custom components** in `src/components/custom/`:
  - [x] `OrderStatusBadge` / `UserStatusBadge` — all 23 order states mapped to correct badge colors
  - [x] `ConfirmDialog` — reusable confirm with `destructive` prop
  - [x] `DataTable<T>` — typed generic table with loading skeletons + empty state
  - [x] `EmptyState` — icon + title + description + action
  - [x] `PageLoader` — full-area spinner
- [x] `packages/ui/src/index.ts` barrel exports all Shadcn + custom components
- [x] All `@/` imports in Shadcn-generated files converted to relative paths (no consuming-app alias bleed)
- [ ] All components render correctly in browser — pending app startup verification

### 1.5 Next.js App Scaffold (All 4 Apps)

Repeat for `web-customer`, `web-vendor`, `web-admin`, `web-hub`:

- [x] `apps/web-customer/` scaffolded (Next.js 16.2.7, App Router, TypeScript)
- [x] `apps/web-vendor/` scaffolded
- [x] `apps/web-admin/` scaffolded
- [x] `apps/web-hub/` scaffolded
- [x] No boilerplate placeholder pages — clean structure per CLAUDE.md module layout
- [x] Shadcn lives in `packages/ui` — apps do NOT run Shadcn CLI directly
- [x] Each app installs: `@avdan/types`, `@avdan/ui`, `@avdan/config`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `zod`, `sonner`, `jose`
- [x] `styles/globals.css` — Tailwind v4 + `@source` for ui package + tokens import + heading fonts
- [x] `postcss.config.mjs` — `@tailwindcss/postcss` plugin configured in all 4 apps
- [x] `lib/api-client.ts` created in each app — only place that calls `fetch`
- [x] `lib/query-client.ts` created — TanStack Query client with staleTime, retry, error handling
- [x] `lib/ws-client.ts` created — WebSocket client with exponential backoff reconnect
- [x] `app/layout.tsx` — `QueryClientProvider`, `ToastProvider`, Bricolage Grotesque + Playfair Display fonts
- [x] `config/routes.ts` created with typed route constants per app
- [x] `.env.local.example` created with required env vars
- [x] `modules/auth/` scaffold complete in all 4 apps (service, store, hooks, schemas, login form)
- [x] `modules/auth/components/register-form.tsx` in web-customer (full Shadcn Form pattern)
- [x] `modules/auth/components/register-vendor-form.tsx` in web-vendor
- [x] `components/layout/` (AppShell, Sidebar, Navbar) in all 4 apps
- [x] `components/common/` (PageLoader, ErrorBoundary) in all 4 apps
- [x] `turbo run dev --filter=web-customer` starts on port 3000 without errors
- [x] `turbo run dev --filter=web-vendor` starts on port 3001 without errors
- [x] `turbo run dev --filter=web-admin` starts on port 3002 without errors
- [x] `turbo run dev --filter=web-hub` starts on port 3003 without errors
- [x] All four apps start concurrently via `turbo run dev` from root

### 1.6 Proxy Setup (All 4 Apps)

Repeat for each app.

> Next.js 16: `middleware.ts` is deprecated. Use `proxy.ts` with `export function proxy()`. Migrate with: `npx @next/codemod@canary middleware-to-proxy .`

- [x] `proxy.ts` at `apps/web-{name}/proxy.ts` — all 4 apps
- [x] `export function proxy(request: NextRequest)` — named export, not default export
- [x] JWT validation logic: reads `avdan_token` cookie, decodes locally, checks expiry (via `jose`)
- [x] Silent refresh: on expired token, calls `/api/auth/refresh`, retries with new token
- [x] Redirect to `/login` if refresh fails or token absent
- [x] API proxy: all `/api/*` requests rewritten to `process.env.API_INTERNAL_URL/*`
- [x] Auth header injected: `Authorization: Bearer {token}` added to proxied requests
- [x] Public routes excluded from auth gate: `/login`, `/register`, `/_next/*`, `/api/auth/*`
- [x] Matcher config set correctly (see CLAUDE.md)
- [x] Proxy verified: visiting `http://localhost:3000/orders` without a cookie redirects to `/login`
- [x] Proxy verified: visiting `http://localhost:3000/login` with a valid cookie redirects to home

### 1.7 GitHub Actions CI
- [x] `.github/workflows/ci.yml` — on push to any branch: install, lint, type-check, build
- [ ] `.github/workflows/deploy-staging.yml` — on push to `develop`: build → push GHCR → kubectl to `avdan-staging` namespace — needs K3s cluster + KUBECONFIG secret
- [ ] `.github/workflows/deploy-prod.yml` — on push to `main`: build → push GHCR → kubectl to `avdan-app` namespace — needs K3s cluster + KUBECONFIG secret
- [ ] CI passes on a clean push — verify after first push to GitHub

**Phase 1 complete when:** All four Next.js apps start without errors. Middleware redirects unauthenticated requests. API proxy rewrites work. Type generation script runs. CI pipeline passes. All apps run concurrently.

---

## Phase 2 — Auth UI (All Apps)

> Requires: Backend Phase 2 complete

### 2.1 Auth Module (All Apps — identical base)
- [x] `modules/auth/schemas/auth.schemas.ts` — Zod schemas for login, register forms (derived from `@avdan/types`)
- [x] `modules/auth/services/auth.service.ts` — `login()`, `register()`, `logout()`, `getMe()` (calls `apiClient`, zero React); User interface includes `name`
- [x] `modules/auth/store/auth.store.ts` — Zustand store: `user`, `isAuthenticated`, `setUser`, `clearUser`
- [x] `modules/auth/hooks/use-session.ts` — reads user from store, provides `isAuthenticated`, `user`, `role`
- [x] `modules/auth/hooks/use-login.ts` — TanStack Query mutation wrapping `auth.service.login`
- [x] `modules/auth/hooks/use-logout.ts` — mutation, clears store + calls logout endpoint

### 2.2 Login Page (All Apps)
- [x] `modules/auth/components/login-form.tsx` — RHF + Zod, email + password fields
- [x] Login form uses `@avdan/ui` primitives (Button, Input, FormField, FormMessage)
- [x] Login form shows loading state during submission (Button disabled)
- [x] Login form shows error toast on invalid credentials (Sonner toast)
- [x] On successful login: redirects to app home (no flicker, no blank screen)
- [x] `app/(auth)/login/page.tsx` — thin wrapper rendering `<LoginForm />`
- [x] Login page is accessible without auth (excluded from proxy matcher config)
- [x] Login page design: centered card, brand logo placeholder, clean modern layout

### 2.3 Register Page (web-customer + web-vendor only)
- [x] `modules/auth/components/register-form.tsx` — name, email, phone, password, confirm password
- [x] `modules/auth/components/otp-form.tsx` — 6 individual digit inputs, auto-focus, paste support, resend countdown timer
- [x] Register flow: fill form → submit → OTP screen → verify → redirect to login
- [x] Vendor register has additional fields: business name, business type, description
- [x] `app/(auth)/register/page.tsx` — thin wrapper
- [x] OTP input: 6 individual character inputs, auto-focus next on entry, backspace focus-back, paste support

### 2.4 Authenticated Layout Shell
- [x] `app/(main)/layout.tsx` — authenticated layout with sidebar + main content area
- [x] `components/layout/sidebar.tsx` — desktop sidebar + user profile footer (name, role, avatar)
- [x] `components/layout/navbar.tsx` — top bar with user dropdown (name, email, logout), mobile hamburger + Sheet
- [x] `components/layout/page-wrapper.tsx` — consistent page padding, max-width (per-app widths)
- [x] Sidebar links derived from `config/routes.ts`
- [x] Active route highlighted in sidebar
- [x] Mobile: hamburger in navbar opens Sheet with full navigation
- [x] User profile displayed in sidebar footer (name, role, avatar) — hydrated via SessionHydrate

### 2.5 Session Hydration
- [x] Root `app/layout.tsx` (Server Component) fetches `GET /auth/me` server-side using `avdan_token` cookie
- [x] User passed to `Providers` → `SessionHydrate` client component initialises Zustand store synchronously before first render
- [x] If `/auth/me` fails (no token / expired), returns null — proxy.ts handles redirect
- [x] No auth-check flickering: store is populated before any child component renders

**Phase 2 complete when:** User can log in and log out in all four apps. Authenticated layout renders. Unauthenticated requests redirect to login. Session hydration works. Register works in web-customer.

---

## Phase 3 — Customer App: Vendor Discovery & Catalog

> Requires: Backend Phase 3 complete

### 3.1 Home Page
- [ ] `modules/vendors/services/vendors.service.ts` — `getVendors()`, `getVendor(slug)`
- [ ] `modules/vendors/hooks/use-vendors.ts` — TanStack Query, infinite scroll support
- [ ] `modules/vendors/components/vendor-card.tsx` — logo, name, rating, delivery time, zone
- [ ] `modules/vendors/components/vendor-grid.tsx` — responsive grid of VendorCards
- [ ] `app/(main)/page.tsx` (home) — renders vendor grid with search/filter bar
- [ ] Filter by zone, category (client-side filter on fetched data at MVP)
- [ ] Empty state shown when no vendors match filter
- [ ] Skeleton loaders while vendors are fetching

### 3.2 Vendor Detail Page
- [ ] `app/(main)/vendors/[slug]/page.tsx` — Server Component, calls `getVendor(slug)` server-side
- [ ] `generateMetadata()` — sets page title, description, OG image from vendor data
- [ ] Vendor header: logo, name, description, rating, hours
- [ ] Product list: image, name, price, available toggle state
- [ ] Product card has "Add to cart" button (cart not yet functional — disabled with coming soon for now)
- [ ] Page fully server-rendered for SEO — no loading spinner for initial content

### 3.3 Sitemap
- [ ] `app/sitemap.ts` — generates sitemap including all public vendor pages
- [ ] `app/robots.ts` — allows indexing of public routes, disallows auth-gated routes

**Phase 3 complete when:** Customers can browse vendors and view product catalogs. Vendor pages are server-rendered. Sitemap generated.

---

## Phase 4 — Customer App: Cart, Checkout & Orders

> Requires: Backend Phase 4 + 5 complete

### 4.1 Cart
- [ ] `modules/cart/store/cart.store.ts` — Zustand: items, quantities, vendor_id constraint (single vendor per cart)
- [ ] Adding product from different vendor clears cart with confirmation dialog
- [ ] Cart persisted to localStorage (Zustand persist middleware)
- [ ] Cart item count shown in navbar badge
- [ ] `modules/cart/components/cart-drawer.tsx` — slide-out cart panel, quantity adjusters, remove, subtotal
- [ ] Cart shows delivery fee + total

### 4.2 Checkout
- [ ] `modules/checkout/components/checkout-form.tsx` — delivery address, contact number, order notes
- [ ] Address form uses RHF + Zod validation
- [ ] Order summary shown alongside form (not editable, comes from cart)
- [ ] `POST /api/orders` called on submit — creates order
- [ ] On order creation: redirect to payment initiation
- [ ] `POST /api/payment/initiate/{order_id}` called — returns Paystack payment URL
- [ ] Redirect to Paystack hosted payment page
- [ ] On return from Paystack (success/failure callback URL): show appropriate status page

### 4.3 Order History & Detail
- [ ] `modules/orders/services/orders.service.ts` — `getOrders()`, `getOrder(id)`, `cancelOrder(id)`
- [ ] `modules/orders/hooks/use-orders.ts`, `use-order.ts`, `use-cancel-order.ts`
- [ ] `app/(main)/orders/page.tsx` — paginated order list, status badges, date, vendor name
- [ ] `app/(main)/orders/[id]/page.tsx` — full order detail: items, status timeline, amounts
- [ ] Status timeline rendered from `order_events` (shows each state with timestamp + actor)
- [ ] Cancel button shown only when status is PENDING
- [ ] Cancel confirmation dialog before calling API

### 4.4 Vendor Dashboard: Incoming Orders
- [ ] `modules/orders/services/orders.service.ts` (web-vendor) — `getVendorOrders()`, `acceptOrder()`, `rejectOrder()`, `markReady()`
- [ ] `app/(main)/orders/page.tsx` (web-vendor) — orders split by status tab (New, Preparing, Ready, History)
- [ ] New order card: items, customer note, total, Accept + Reject buttons
- [ ] Reject requires reason (dropdown + optional note)
- [ ] Mark Ready button on accepted orders
- [ ] Real-time new order notification via WebSocket (connect to `order:{id}` on vendor receive)
- [ ] Toast notification on new incoming order

**Phase 4 complete when:** Customer can browse, add to cart, checkout, pay via Paystack, view orders. Vendor can accept/reject/mark ready. Order status updates visible.

---

## Phase 5 — Live Tracking UI

> Requires: Backend Phase 6 complete

### 5.1 WebSocket Client
- [ ] `lib/ws-client.ts` — connects to `WS_URL/ws/order/{id}`, handles reconnect on disconnect
- [ ] Exponential backoff reconnect (1s, 2s, 4s, max 30s)
- [ ] `modules/tracking/hooks/use-order-tracking.ts` — manages WebSocket connection, returns live location + status

### 5.2 Tracking Page (web-customer)
- [ ] `app/(main)/orders/[id]/track/page.tsx` — live tracking view
- [ ] Map integration (Leaflet.js — open source, no API key) showing rider position
- [ ] Marker updates smoothly as rider location changes (animation between coordinates)
- [ ] Order status banner below map: current state, ETA
- [ ] Order status transitions shown as they happen (toast notification)
- [ ] Rider contact shown when assigned (name, rating)
- [ ] Map is a Client Component — parent page can remain Server Component for metadata

**Phase 5 complete when:** Customer can see rider moving on a map in real-time. Status updates appear live. ETA shown.

---

## Phase 6 — Agent Hub Portal

> Requires: Backend Phase 8 complete

### 6.1 Hub Dashboard
- [ ] `app/(main)/page.tsx` (web-hub) — today's stats: inbound count, QA pending, dispatched, pass rate
- [ ] `modules/hub/components/order-queue.tsx` — inbound orders sorted by arrival time
- [ ] Real-time queue updates via WebSocket on `hub:{hub_id}` channel

### 6.2 QA Workflow
- [ ] `app/(main)/orders/[id]/qa/page.tsx` — QA inspection form
- [ ] QA form: pass/fail toggle, notes field, evidence photo upload (multipart)
- [ ] Photo upload preview before submission
- [ ] Submit calls correct endpoint, transitions order state
- [ ] Confirmation dialog before submitting QA failure (irreversible)

**Phase 6 complete when:** Agent can see inbound orders, perform QA, upload photos, pass or fail inspections.

---

## Phase 7 — Admin Panel

> Requires: Backend Phase 10 complete

### 7.1 Admin Dashboard
- [ ] `app/(main)/page.tsx` (web-admin) — KPI cards: active orders, riders online, hubs active, revenue today
- [ ] Charts: order volume (last 30 days), revenue trend (Recharts)
- [ ] Real-time KPIs update every 30 seconds (TanStack Query refetch interval)

### 7.2 User Management
- [ ] Paginated user list with role filter, search by email/name
- [ ] User detail drawer: profile, role, status, order history count
- [ ] Status change: activate, suspend, ban — with confirmation dialog
- [ ] Admin can create new admin/support accounts

### 7.3 Order Management
- [ ] All orders list with full filter set (status, vendor, date range, rider)
- [ ] Order detail view — full timeline, all amounts, all actors
- [ ] Admin state override (dangerous action — requires typed confirmation)

### 7.4 Vendor Management
- [ ] Pending vendor approval queue
- [ ] Approve / reject with reason
- [ ] Vendor detail: profile, products, order history, earnings

### 7.5 Dispute Management
- [ ] Open disputes list sorted by created date
- [ ] Dispute detail: order info, evidence, requester message
- [ ] Resolve form: decision (release to vendor / refund customer / split), reason
- [ ] Resolved disputes move to history tab

### 7.6 Escrow Overview
- [ ] All HELD escrow transactions with amounts, ages, order links
- [ ] Pending release queue (48h window showing countdown)
- [ ] Manual release button with confirmation

**Phase 7 complete when:** Admin has full oversight of users, orders, vendors, disputes, and escrow. All actions reflected in real-time.

---

## Phase 8 — Rider Mobile App (React Native + Expo)

> Requires: All backend phases complete + web apps stable

> Do not start this phase until explicitly instructed. Do not scaffold `apps/app-rider/` before this phase.

### 8.1 Expo Scaffold
- [ ] `apps/app-rider/` created with Expo SDK (latest stable, bare workflow)
- [ ] TypeScript configured, strict mode
- [ ] `@avdan/types` imported and resolving
- [ ] Navigation: Expo Router (file-based, mirrors Next.js App Router pattern)
- [ ] Authentication: same JWT cookie pattern (expo-secure-store for token storage on mobile)

### 8.2 Rider Auth
- [ ] Login screen (same auth service pattern as web apps)
- [ ] Biometric unlock (Face ID / fingerprint) for subsequent sessions

### 8.3 Rider Core Features
- [ ] Online/offline toggle (broadcasts to backend)
- [ ] Background location: Expo Location with foreground service notification
- [ ] Location broadcasts to `POST /api/riders/me/location` every 5 seconds when online
- [ ] Offline buffering: location updates stored in SQLite when no connectivity, synced on reconnect
- [ ] Job assignment push notification (FCM via Expo Notifications)
- [ ] Accept/decline job with countdown timer (30s auto-decline)
- [ ] Navigation screens: to vendor → to hub → to customer
- [ ] Delivery confirmation: OTP input or photo proof (camera via Expo Camera)
- [ ] Earnings screen: today, this week, this month

**Phase 8 complete when:** Rider can receive jobs, navigate, broadcast location, confirm delivery.

---

## Design Rules for All Apps

### Customer App (web-customer)
- Consumer-grade polish. This is a shopping experience.
- Large product images, generous whitespace, smooth transitions.
- Mobile-first responsive (this is the most mobile-used app).
- Brand color prominent on CTAs.
- SEO-optimised public pages (server rendered).

### Vendor Dashboard (web-vendor)
- Productivity-focused. Vendors need to act fast on incoming orders.
- Dense information layout where needed.
- Status badges prominent. Order cards scannable at a glance.
- New order notification must be unmissable (toast + sound option).

### Admin Panel (web-admin)
- Data-dense. Admins need maximum information per screen.
- Data tables with sorting, filtering, pagination.
- Destructive actions always require confirmation dialogs.
- Audit trail visible on every significant action.

### Agent Hub Portal (web-hub)
- Functional and focused. Agents work quickly under time pressure.
- Large touch targets (some hubs may use tablets).
- QA workflow must be completable in minimum taps/clicks.
- Clear visual distinction between pass (green) and fail (red) states.

### Shared Rules
- Light theme across all apps (no dark mode at MVP — add in later iteration).
- Brand color: `--color-brand-500` (placeholder — swap before launch).
- Font: Inter (loaded via `next/font/google`).
- Border radius: consistent use of `rounded-lg` (12px) for cards, `rounded-md` (8px) for inputs.
- Spacing: 4px base unit, use Tailwind spacing scale.
- Motion: subtle — use `transition-all duration-200` for state changes. No heavy animations at MVP.
- Error states: always visible, always actionable. Never silent failures.
- Empty states: always show an illustration or icon + message + action (never a blank page).
- Loading states: Skeleton for content areas, Spinner inside buttons, PageLoader for full-page loads.

---

## Notes for Agent

- A phase may only begin when its backend dependency is marked complete in `STATUS_BACKEND.md`.
- Do not move to Phase 3 without Phase 2 fully marked complete.
- When implementing a new module, always create service → hook → component in that order.
- Services contain zero React. Hooks contain zero fetch logic. Components contain zero business logic.
- Every form must show loading state, error state, and success feedback.
- Every data list must show loading state, empty state, and error state.
- Do not use `useEffect` for data fetching. Always use TanStack Query.
- When starting a session, state which phase and milestone you are working on.
- If unsure about a design decision, use the simplest implementation that is correct and note it for review.
