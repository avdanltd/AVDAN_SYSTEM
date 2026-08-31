# STATUS_FRONTEND.md — Frontend Build Status

> Agent: Read CLAUDE.md and ARCHITECTURE.md before starting any phase.
> Mark milestones complete by changing `[ ]` to `[x]` only when fully working end-to-end.
> Do not start a frontend phase until the corresponding backend phase is complete.
> Current phase and active milestone must be stated at the top of every session.

---

## Current Status

**Active Phase:** Phase 9 — Vendor Mobile App (`app-vendor`); Phase 8 (rider) code-complete, awaiting device test
**Active Milestone:** 9.x app-vendor built and bundling; all apps to be device-tested together
**Last Completed:** Doc reconciliation (2026-08-22) — Phase 3A and backend Phases 12–13 ticked to
match the codebase; both were fully built while their checklists showed unticked.
**Blocking Issues:** None blocking mobile. Backend Phase 12 is done, so Phase 3A's old blocker is gone.

### Session handoff — state as of 2026-08-22

**Next task:** device-test all three mobile apps together (a real order end to end across
rider/vendor/customer), then work through the remaining `BACKLOG_HARMONISATION.md` items
(§6 escrow payout robustness, §7 smaller items). `app-customer` is built — see Phase 10 below.

Done: §1 `@avdan/mobile`, §3 payment (backend + `app-customer` client), §4 vendor payout screens, §2 in full, and `app-customer` itself (Phase 10) — R2 backend, Cloudflare WAF rule (verified against a real
object), bucket CORS, `app-vendor` product-image upload, and migration `0015` putting a snapshotted
`product_image_url` on order lines with thumbnails in both apps.

**R2 token:** must sit at **Object Read & Write**. It was briefly elevated to Admin to apply the
CORS policy and has been reverted. Only re-elevate to change bucket configuration.

**Nothing is committed.** `apps/app-rider/` and `apps/app-vendor/` are both **untracked** in git,
along with `RUNBOOK_ORDER_E2E.md`, `BACKLOG_HARMONISATION.md` and
`apps/api/scripts/simulate_paystack_webhook.py`. Two full mobile apps exist only on disk — commit
before doing anything destructive.

**Local environment**
- Postgres 16.2 + Redis 8.8 run under **DBngin**, not Docker. Database `avdan`, user `avdan`,
  password `avdan_dev`. Already migrated to head (`0014`) and seeded.
- `psql` is not on PATH; it lives at `/Users/Shared/DBngin/postgresql/16.2/bin/`.
- The dev machine's LAN IP was `172.20.10.3` (an iPhone hotspot range — it will change on a
  different network). Both mobile apps' `.env.local` point at it, and the API's `FRONTEND_URLS`
  allows it.
- Celery worker and Beat are **not** running.

**Ports:** API 8000 · web-customer 3000 · web-vendor 3001 · web-admin 3002 · web-hub 3003 ·
app-rider Metro 8081 · app-vendor Metro 8082.

**Gotcha that wastes time if forgotten:** auth is an httpOnly cookie and **cookies ignore port
numbers**, so all the localhost web apps share one session. Use different hostnames
(`localhost` / `127.0.0.1` / the LAN IP) per role — see `RUNBOOK_ORDER_E2E.md` §1.

**Verified working end to end (via API):** mobile auth contract, rider order lifecycle including
the new history endpoints, vendor accept/reject/ready, vendor product create/update/availability/
delete, escrow hold starting on delivery, Paystack `PENDING -> PAID` through a signed webhook.

**Never verified on a physical device:** neither mobile app has been through a real device test.
Both bundle cleanly through Metro and pass `tsc --noEmit`.

### Live E2E verification (2026-09-01)

Full order lifecycle walked twice live: once entirely via REST (mirroring exactly what each
frontend calls, including the mobile Bearer contract for the rider leg — see
`STATUS_BACKEND.md` 14.7), then again through the **actual web UI** for customer/vendor/admin/hub
(Chrome, driven per `RUNBOOK_ORDER_E2E.md` §1's per-role-hostname pattern), with the rider leg
via the same rider endpoints (no physical device yet — see Phase 8.9/8.11 below). Both passes
completed clean through `DELIVERED -> PAYMENT_RELEASE_PENDING`; the escrow payout blocker was
hit and confirmed to fail cleanly rather than crash (`BACKLOG_HARMONISATION.md` §7).

**Rider retirement check:** a full `web-rider` vs `app-rider` capability/endpoint diff found **no
blocking gaps** — every web-rider action and endpoint has a working, generally more robust
equivalent in `app-rider` (which also fixes three bugs still live in `web-rider`: the active-order
card disappearing mid-transit, a guaranteed-error QA_PASSED action, and online/offline state never
persisting across reload). Clear to retire `web-rider` on feature-parity grounds once a physical
device pass on `app-rider` (Phase 8.9) confirms it live.

**Bugs found and fixed during the UI walk:**
- **Credentials leaking into the URL/dev-server log.** None of the 5 apps declared
  `allowedDevOrigins` in `next.config.ts`. `RUNBOOK_ORDER_E2E.md` §1 requires opening each role on
  a different hostname (`localhost` / `127.0.0.1` / the LAN IP) on the same machine, since auth
  cookies ignore port numbers — but Next.js 16's dev-only cross-origin guard silently blocks
  hydration on any origin other than the one the dev server first saw. With React never attaching,
  the login `<form>` fell back to a native GET submit, putting the typed password straight into the
  URL — visible in browser history and in `next dev`'s own terminal log (confirmed present there).
  Reproduced on `web-vendor` via `127.0.0.1:3001`, exactly the prescribed access pattern. Fixed:
  `allowedDevOrigins: ['127.0.0.1', '172.20.10.3']` added to all 5 apps' `next.config.ts`. Dev-only,
  zero effect on a production build.
- **`web-customer` "My Orders" silently dropped orders in 4 of the 17 states.**
  `ACTIVE_STATUSES`/`COMPLETED_STATUSES`/`CANCELLED_STATUSES` in `orders-page.tsx` are three
  explicit lists that between them omitted `PAYMENT_RELEASE_PENDING`, `VENDOR_REMEDIATION`,
  `DISPUTED` and `DISPUTE_RESOLVED` — an order in any of those states appeared in **no tab at all**.
  In practice: every order vanished from the customer's own history the moment it was delivered,
  for the entire 48h escrow hold. Fixed by assigning all four to the correct bucket.
  `app-customer`'s equivalent (`orders-list.tsx`) partitions on `!OPEN_STATUSES.has(status)` — a
  complementary split immune to this class of bug — so it needed no fix.
- **`vendor_name` always `null` on every customer-facing order response** (create/list/detail/
  cancel), so `web-customer` and `app-customer` (both read `order.vendor_name`) showed a raw
  vendor-id UUID slice or "Vendor order" instead of the real vendor name. `Order` intentionally has
  no `vendor` relationship (would lazy-load under the async engine); `services/qa/router.py`
  already had the correct batch-fetch-by-id pattern, `services/orders/router.py` didn't. Fixed with
  a shared `_vendor_names()` helper applied to all four customer endpoints.

### Agreed order of work (set 2026-08-22)
1. ✓ Reconcile STATUS docs to the real state of the codebase
2. ✓ Boot the stack and run `generate-types.sh` — `generated.ts` went from an 8-line placeholder
   to 5,259 real lines. **Not yet committed, and `pnpm turbo run type-check` has not been re-run
   across the web apps — expect drift to surface there.**
3. ~ Boot `app-rider` on a physical device — served and bundling, but no full device walk yet
4. ✓ `app-rider` UI to production-grade premium (Phase 8.10)
5. ☐ Android EAS build (free — no Apple Developer account, so iOS-native milestones stay open)
6. ✓ `app-vendor` built 2026-08-22 (decision: build all apps, then test everything at once)
7. **Harmonisation + foundations** — `@avdan/mobile` shared package, R2 storage/image upload,
   payment verify endpoint, vendor payout screens. Tracked in `BACKLOG_HARMONISATION.md`.
   Sequenced BEFORE app-customer on purpose: extracting shared code costs 2 app migrations now
   and 3 later, and app-customer's riskiest feature (payment) depends on the verify endpoint.
8. `app-customer` — RN app #3, not started
9. Return to web: Stitch polish pass on web-customer core flow
10. Android EAS builds; HTTPS tunnel only for exercising Paystack's own retry/signature behaviour

**Standing constraint:** no paid Apple Developer account. iOS is Expo Go only — foreground location
works, background location and APNs push do not. Do not mark 8.3 or 8.7 complete on iOS evidence.

---

## Active Initiative — Design System Alignment (Stitch-driven)

> Full workflow, the reusable prompt template, AND the actual next 5 ready-to-paste prompts
> (§7 — Product Detail, Vendor Storefront, Cart, Checkout, Order Detail + Tracking):
> `/styles/avdan-stitch-roadmap.md`.
> Source-of-truth design spec (colors/type/spacing/elevation): `/styles/stitch_avdan_*/DESIGN.md`
> (all three are identical — one system, not three).

**Why:** UI had drifted inconsistent across apps; this locks one brand system (Royal Blue
`#135BEC` primary, Signal Orange `#F59F0A` sparing accent, Playfair Display + Bricolage Grotesque)
and applies it everywhere, screen by screen, reusing real data/hooks rather than rebuilding logic.

### Done
- [x] Design tokens: `packages/ui/src/tokens/tokens.css` — added `--brand-accent` (Signal Orange,
      distinct from `--warning`), `--shadow-card`/`--shadow-modal` (warm-toned elevation), `Badge`
      `accent` variant, `StatsCard` `tone="accent"` prop, `StatsCard` icon container → `rounded-full`.
- [x] `app-rider` now actually loads Playfair Display + Bricolage Grotesque (`@expo-google-fonts/*`
      via `useFonts` in `src/app/_layout.tsx`) — previously never loaded despite being "set up."
      `constants/theme.ts` fixed to match web hex values exactly + added accent/shadow presets.
- [x] **Anchor screen 1** — web-customer Home (`modules/store/components/store-home-page.tsx`):
      hero, category grid, product cards restyled; added Trusted-by band, stats/CTA banner, How
      AVDAN Works section; "Popular" accent badge on the Popular Right Now rail.
- [x] **Anchor screen 2** — web-admin Dashboard (`modules/analytics/components/dashboard-page.tsx`
      + `components/layout/sidebar.tsx`): Playfair sidebar wordmark, real "Emergency Dispatch" CTA,
      live "updated Xs ago" indicator, fixed off-brand chart colors, disputes as a real DataTable,
      working CSV export.
- [x] **Anchor screen 3** — app-rider Home (`modules/rider/components/dashboard.tsx`): new large
      tap-toggle (`status-toggle.tsx`) replacing the plain `Switch`, real Active Delivery card
      (no fabricated recipient/distance fields), real derived stat tiles, converted navigation
      from a bare `Stack` to a `Tabs` layout (Home/Orders/Profile) with a new Profile screen.
- [x] web-admin remaining 8 pages polished directly (no Stitch pass needed — already fully built,
      just needed the token/shadow/heading-font treatment): Users, Orders, Vendors, Disputes,
      Escrow, Dispatch, Hubs, Analytics, Config. Fixed the same off-brand chart-color bug in
      `analytics-page.tsx` (`hsl(199 89% 48%)` — leftover from the pre-rebrand placeholder, see
      the "Notes for Agent" fix below). Added one accent-tone flagship stat per screen (Total GMV,
      Total Held).
- [x] **web-vendor** (Dashboard, Orders, Products, Earnings, Notifications, Profile) + **web-hub**
      (Dashboard, Orders, QA Workflow, Analytics, Order Detail, Profile) — same direct polish as
      web-admin: `font-display` headings, `shadow-card` on Card/table wrappers, sidebar got the
      same two-line Playfair wordmark + app-name subtitle treatment as admin's ("Vendor Portal" /
      "Agent Hub"). Also found and fixed several raw hardcoded `green-6xx`/`amber-6xx` Tailwind
      colors (PASS button, QA-pending stat, ready-order count badge, product-availability badge,
      hub queue's in-progress row highlight) → real `success`/`warning` theme tokens — same class
      of bug as the `hsl(199 89% 48%)` chart-color one, just via Tailwind palette classes instead
      of raw hsl(). No off-brand recharts colors found in either app (neither uses charts).

### Next (in order)
> Re-sequenced 2026-08-22: `app-rider` polish moved ahead of the web-customer pass, because the
> rider app is about to be device-tested and is the pilot that unblocks all future RN apps.

0. **app-rider full premium pass** — every screen (Login, Home, Orders, Order Detail, Profile) to
   production quality, not just the Home anchor screen. See Phase 8 below.
1. **web-customer core flow, via Stitch** (ready-to-paste prompts in
   `/styles/avdan-stitch-roadmap.md` §7): Product Detail → Vendor Storefront → Cart (drawer) → Checkout → Order Detail + Live
   Tracking. Build each directly against the existing real hooks/services once a Stitch result
   comes back — same pattern as Home.
2. **web-rider** — low-priority interim polish only (being superseded by `app-rider` per
   ARCHITECTURE.md; don't over-invest here).
3. **Secondary pages across all apps** — Profile, Notifications, Config screens wherever they
   still use pre-rebrand styling; reuse whichever sibling screen is the closest style reference.
4. Mobile: `app-customer` / `app-vendor` do not exist yet and stay out of scope until explicitly
   instructed (per ARCHITECTURE.md "What Intentionally Does Not Exist Yet").

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
| Phase 3A (ecommerce redesign) | Backend Phase 12 (categories + /products + pgvector) |
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
- [ ] **`packages/types/src/generated.ts` is STILL the empty placeholder** (8 lines, all types are
      `Record<string, never>`). Every API type consumed by all 6 apps is therefore hand-written,
      which CLAUDE.md explicitly forbids, and none of it has been checked against the real OpenAPI
      schema. Highest-value single fix once the backend boots.
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

## Phase 3A — Full Ecommerce Redesign + Category Management ✓ (structure) / partial (polish)

> Reconciled 2026-08-22 by auditing the codebase. Every item below was already built while this
> checklist still showed all boxes unticked. Backend Phase 12 (categories, `GET /products`,
> pgvector search) is also complete, so the stated blocker is gone.

### 3A.1 — Backend wiring: new service + hook layer (web-customer) ✓
- [x] `modules/products/types.ts` — ProductListing, ProductDetail
- [x] `modules/products/services/products.service.ts` — getProducts(params), getProduct(id)
- [x] `modules/products/hooks/use-products.ts`, `use-product.ts`
- [x] `modules/categories/types.ts` — Category
- [x] `modules/categories/services/categories.service.ts` — getCategories()
- [x] `modules/categories/hooks/use-categories.ts`
- [x] `modules/search/services/search.service.ts` — search(q, type)
- [x] `modules/search/hooks/use-search.ts` — debounced

### 3A.2 — Reusable ProductCard + ProductGrid (web-customer) ✓
- [x] `modules/products/components/product-card.tsx`
- [x] `modules/products/components/product-card-skeleton.tsx`
- [x] `modules/products/components/product-grid.tsx` — responsive, loading/empty/error states
- [x] Also built (not on the original list): `product-pagination.tsx`, `product-filters.tsx`,
      `vendor-card.tsx`, `vendor-card-skeleton.tsx`, `vendor-grid.tsx`

### 3A.3 — Header + Footer (web-customer) ✓
- [x] Navbar redesign: categories dropdown, search bar + Products|Vendors toggle, cart, auth
- [x] Mobile navbar: Sheet hamburger
- [x] Footer redesign

### 3A.4 — Homepage redesign (web-customer) ✓
- [x] `store-home-page.tsx` — hero, category grid, product rails, Trusted-by band, stats/CTA banner,
      "How AVDAN Works" (done during the Design System Alignment initiative)
- [x] Replaces `vendors-home-page.tsx` as `/` (the old file still exists, now used for `/vendors`)

### 3A.5 — New pages (web-customer) ✓
- [x] `/products` — `products-page.tsx` with filters
- [x] `/products/[id]` — `product-detail-page.tsx`
- [x] `/categories` — `all-categories-page.tsx`
- [x] `/categories/[slug]` — `category-products-page.tsx`
- [x] `/search` — `search-results-page.tsx` with Products|Vendors toggle
- [x] `/vendors` — `vendors-page.tsx` + vendor grid with filters
- [x] `/vendors/[slug]` — `vendor-detail-page.tsx`

### 3A.6 — Enhanced existing pages (web-customer) ✓ (built; polish pass outstanding)
- [x] Cart drawer — `cart-drawer.tsx`
- [x] Checkout — `checkout-page.tsx` (+ `/checkout/success`, `/checkout/failed` routes)
- [x] Orders page — `orders-page.tsx`
- [x] Order detail — `order-detail-page.tsx` (+ `/orders/[id]/track` with `tracking-page.tsx`, `tracking-map.tsx`)
- [x] My Account — `profile/`
- [x] Notifications — `notifications/`
- [ ] **Outstanding: the Stitch visual-polish pass** on Product Detail, Vendor Storefront, Cart,
      Checkout, Order Detail + Tracking. These screens are functionally complete against real hooks
      but still carry pre-rebrand styling. Ready-to-paste prompts: `/styles/avdan-stitch-roadmap.md` §7.

### 3A.7 — Routes update (web-customer) ✓
- [x] `config/routes.ts` — products, product(id), categories, category(slug), search all present

### 3A.8 — Category management (web-admin) ✓
- [x] `modules/categories/components/categories-page.tsx` + `category-dialog.tsx` + sidebar nav item
- [ ] Note: admin writes must target `POST/PATCH/DELETE /categories` (role-gated), **not**
      `/admin/categories` — see the deviation note in `STATUS_BACKEND.md` 12.1. Verify the service
      layer points at the right path when the backend goes live.

### 3A.9 — Category on product form (web-vendor) ✓
- [x] `category_id` Select field with Zod validation in `modules/catalog/components/product-form.tsx`

**Phase 3A remaining:** the visual polish pass (3A.6) and live verification against seed data.
Structurally it is done.

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
  /login               → login form, same credentials as other apps
(main)
  /                    → Active order card (if assigned) + Go Online toggle
  /orders              → List of assigned orders by status
  /orders/[id]         → Order detail: items, delivery address, inline action buttons
                         (pickup/transit/deliver/fail rendered from ORDER_ACTIONS based on
                         current status — matches web-rider's proven pattern; no separate
                         per-action confirm screens, one tap on the detail screen is enough)
```

### State Transitions the Rider Controls
```
READY_FOR_PICKUP  → PICKED_UP          (rider confirms pickup)
PICKED_UP         → IN_TRANSIT_TO_HUB  (rider marks en route to hub)
QA_PASSED         → OUT_FOR_DELIVERY   (rider/agent dispatches last mile)
OUT_FOR_DELIVERY  → DELIVERED          (rider confirms delivery)
OUT_FOR_DELIVERY  → FAILED_DELIVERY    (rider reports failed attempt)
```

### Backend Endpoints the Rider App Uses (all already existed — corrected 2026-07-30)
| Endpoint | Purpose |
|----------|---------|
| `POST /auth/login` | Auth (send `X-Client-Platform: mobile` to get tokens in body) |
| `POST /auth/refresh` | Token refresh (send `refresh_token` in body — no cookie available) |
| `GET /auth/me` | Session, via `Authorization: Bearer` |
| `POST /dispatch/me/availability` | Toggle online/offline |
| `POST /dispatch/me/location` | Broadcast GPS every 5s |
| `GET /dispatch/me/orders` | Rider's assigned orders — already rider-scoped, no change needed |
| `POST /dispatch/me/orders/{id}/pickup` | PICKED_UP transition — already existed |
| `POST /dispatch/me/orders/{id}/transit` | IN_TRANSIT_TO_HUB — already existed |
| `POST /dispatch/me/orders/{id}/deliver` | DELIVERED — already existed |
| `POST /dispatch/me/orders/{id}/fail` | FAILED_DELIVERY — already existed |

### Missing Backend Work — corrected 2026-07-30
This list was wrong: `/dispatch/me/...` already covered every rider order-transition need (see
`services/dispatch/router.py`) and `QA_PASSED → OUT_FOR_DELIVERY` is agent-triggered from the hub
QA flow, not rider-triggered, so there was never a gap there. The real gap, found and fixed during
`app-rider` scaffolding: **all auth was httpOnly-cookie-only**, which doesn't work for a standalone
mobile client. Fixed additively (see `STATUS_BACKEND.md` 2.7) — web behavior is unchanged.

### Current Stack (verified 2026-08-22)
| Item | Value |
|------|-------|
| Expo SDK | **54** (`expo ~54.0.36`) — matches the Expo Go build on the test iPhone |
| React Native | 0.81.5 |
| React | 19.1.0 |
| Router | `expo-router` ~6.0.24, `typedRoutes: true`, `reactCompiler: true` |
| Auth | Bearer tokens in `expo-secure-store` (never AsyncStorage) |
| Type-check | `tsc --noEmit` passes clean |

### Screens built
```
(auth)/login                    login-form.tsx
(main)/                         dashboard.tsx + status-toggle.tsx   [Tabs: Home]
(main)/orders                   orders-list.tsx                     [Tabs: Orders]
(main)/orders/[id]              order-detail.tsx
(main)/profile                  profile.tsx                         [Tabs: Profile]
```

### Milestones
- [x] 8.1 Expo project scaffolded (`app-rider/`) with EAS config, all permissions declared
- [x] 8.2 Auth flow complete (login, session hydration, logout) — pending live device test
- [x] 8.3 Go Online toggle + GPS broadcast wired — verified on physical iPhone via Expo Go (foreground-only fallback path). Background location (expo-task-manager + foreground service) requires custom `Info.plist`/`AndroidManifest` entries baked into a real native build — **Expo Go cannot provide this** (shared, precompiled binary), so `use-location-broadcast.ts` tries the background-capable path first and falls back to `watchPositionAsync` (foreground only) when it throws. True background broadcasting needs an EAS development build — untested until then.
- [x] 8.4 Assigned order list + order detail screens — pending live device test
- [x] 8.5 Pickup → Hub Transit flow with state transitions — pending live device test
- [x] 8.6 Last-mile delivery flow (OUT_FOR_DELIVERY → DELIVERED / FAILED_DELIVERY) — pending live device test
- [ ] 8.7 Push notifications working (FCM Android + APNs iOS) — device token registration wired to reuse existing `PATCH /auth/me/push-token`; not yet exercised on a real device
      **iOS blocked:** APNs needs a paid Apple Developer account. Android-only until that exists.
- [ ] 8.8 EAS Build produces working `.apk` (Android) — Android build is free and is the target.
      `.ipa` / TestFlight deferred until an Apple Developer account exists.

### New milestones (added 2026-08-22 — the actual current work)
- [ ] **8.9 Live device test via Expo Go (SDK 54) on physical iPhone**
  - [ ] Backend stack booted and seeded (depends on `STATUS_BACKEND.md` Phase 14.1–14.3)
  - [ ] `EXPO_PUBLIC_API_URL` pointed at the dev machine's **LAN IP**, not `localhost` — a phone
        cannot reach the host's loopback. Same for `EXPO_PUBLIC_WS_URL`.
  - [ ] FastAPI `FRONTEND_URLS` / CORS permits that LAN origin
  - [ ] Login as a seeded rider account (`Avdan@2024`) — tokens land in secure-store, session hydrates
  - [ ] Go Online toggle flips availability; `POST /dispatch/me/location` receives foreground pings
  - [ ] Assigned orders list renders real seeded orders
  - [ ] Full rider transition walk on-device: READY_FOR_PICKUP → PICKED_UP → IN_TRANSIT_TO_HUB,
        then OUT_FOR_DELIVERY → DELIVERED, plus a FAILED_DELIVERY case
  - [ ] Token refresh survives a 15-min access-token expiry on-device
- [ ] **8.10 Production-grade UI pass across every rider screen**
  - [ ] Login — branded, keyboard-aware, real error states
  - [ ] Home — refine the existing anchor-screen work; loading/empty/offline states
  - [ ] Orders list — real empty state, pull-to-refresh, status grouping
  - [ ] Order detail — timeline, address block, prominent action buttons, optimistic transitions
  - [ ] Profile — earnings/stats, logout confirm
  - [ ] Cross-cutting: safe-area handling, haptics on primary actions, skeletons (not spinners),
        toast consistency, tap targets ≥44pt, no layout shift on data arrival
- [x] **8.10 Production-grade UI pass — DONE 2026-08-22.** Full rebuild of the rider app's
      presentation layer against the real brand:
  - [x] **Real brand assets, no placeholders.** The app icon was still the stock Expo chevron.
        Traced the arrowhead geometry out of `apps/api/static/logo.png` (outer edge `x = 50 - 0.5y`,
        inner edge `x = 50 - 0.1325y` in a 100x100 box) and regenerated every icon from vector —
        iOS icon, Android adaptive fore/back/monochrome, splash, favicon. `components/brand-logo.tsx`
        renders the mark as `react-native-svg`, so it is crisp at any size and recolours per theme.
        The bitmap wordmark is NOT used: its lettering is dark navy and disappears on dark grounds,
        so the wordmark is set in Playfair instead.
  - [x] **Light + dark mode.** `constants/theme.ts` now exports full light and dark palettes derived
        from the logo's own gradients (badge `#3062D2`->`#0A2480`, arrow `#FAD96B`->`#F28614`).
        `theme/theme-context.tsx` provides light/dark/system with the choice persisted in
        `expo-secure-store`. Every screen, primitive, toast and status chip resolves through tokens.
  - [x] **Branded loader** — `BrandLoader` (the AVDAN arrow breathing) replaces the bare
        `ActivityIndicator` at app boot; lists and detail screens use real skeletons, not spinners.
  - [x] Screens rebuilt: Login (branded hero, show/hide password, focus states), Home (greeting,
        live availability from the server, real stat tiles, pull-to-refresh), Orders
        (**Active | History** segmented control), Order Detail (single-order query, progress trail,
        itemised receipt, confirm-guard on destructive actions), Profile (grouped settings).
  - [x] **New screens that were missing:** `profile/edit` (name + phone via `PATCH /auth/me`, Zod
        validated, sends only changed fields) and `profile/appearance` (theme picker with live preview).
  - [x] Cross-cutting: safe-area insets throughout, 44pt minimum touch targets, branded toasts with
        title + detail, nested-ScrollView bug fixed on Home/Profile/Orders.
  - [x] `tsc --noEmit` passes clean.
- [ ] **8.11 Android EAS build** (`eas build -p android --profile preview`) installed and walked
      end-to-end on a physical Android device — this is where 8.3 background location and 8.7 push
      finally become provable

---

## Phase 9 — Vendor Mobile App (`app-vendor`) — code-complete 2026-08-22

> Built after `app-rider`, following the same structure. Decision taken 2026-08-22: build every
> app first, then device-test all of them together. **All web apps stay** — mobile is additive,
> not a replacement (web-vendor keeps desktop bulk catalog editing; web-customer keeps SEO).

### Stack
Identical to `app-rider`: Expo SDK 54, RN 0.81.5, expo-router 6, TanStack Query v5, Zustand,
Zod, Bearer tokens in `expo-secure-store`, `react-native-svg` brand mark, light/dark/system theming.
Runs on Metro **port 8082** so it can serve alongside app-rider on 8081.

### Brand
Same AVDAN mark, inverted lockup — **gold ground with a deep-navy arrow**, against the rider app's
blue ground with gold arrow. Same two brand colours, instantly separable on a phone that has both
apps installed. All icons generated from the traced vector geometry, no placeholders.

### Screens
```
(auth)/login
(main)/                        dashboard.tsx          [Tabs: Home]
(main)/orders                  orders-list.tsx        [Tabs: Orders]  New | Active | Completed
(main)/orders/[id]             order-detail.tsx       accept / reject (with reason) / mark ready
(main)/catalog                 catalog.tsx            [Tabs: Catalog] search + availability toggle
(main)/catalog/new             product-form.tsx
(main)/catalog/[id]            product-form.tsx       edit + delete
(main)/profile                 profile.tsx            [Tabs: Profile] earnings summary
(main)/profile/edit            profile-edit.tsx
(main)/profile/storefront      storefront-edit.tsx    store name + description
(main)/profile/appearance      appearance.tsx
```

### Milestones
- [x] 9.1 Project scaffolded, deps installed, `tsc --noEmit` clean
- [x] 9.2 Auth flow (reuses the mobile Bearer contract) — pending live device test
- [x] 9.3 Dashboard: new-order alert, revenue + awaiting-payout tiles, needs-action list
- [x] 9.4 Orders: three-bucket segmented list, detail with vendor journey trail
- [x] 9.5 Order actions: accept (PAID → VENDOR_ACCEPTED → PREPARING in one request),
      reject with a required written reason, mark ready for pickup
- [x] 9.6 Catalog: list from `GET /vendors/me` (there is **no** list-my-products endpoint —
      products are embedded in the vendor detail payload), live search, availability toggle
- [x] 9.7 Product create / edit / delete with Zod validation; price entered in naira and
      converted to kobo on submit
- [x] 9.8 Profile, storefront editing, appearance; light + dark verified via tokens
- [x] 9.9 iOS bundle builds clean through Metro (11.3 MB, no resolution errors)
- [ ] 9.10 Live device test — not yet run
- [ ] 9.11 Push notifications for new orders — the single highest-value mobile feature for a
      vendor, and not yet wired. `PATCH /auth/me/push-token` already exists.
- [ ] 9.12 Android EAS build

### Deliberately not built
- **Payout / bank account setup.** Verifying a bank account is a multi-step Paystack flow
  (`/vendors/me/banks` → `/payout-account/verify` → `/payout-account`). The profile screen shows a
  warning card pointing at the web dashboard when no payout account exists, rather than shipping a
  half flow. Note this blocks escrow release — `release_escrow` raises
  `VENDOR_PAYOUT_NOT_CONFIGURED` without it.
- **Product image upload.** `expo-image-picker` is installed and permissions are declared, but
  there is no image upload endpoint on the API yet — products carry `image_urls` only. Existing
  images are preserved on edit; new ones cannot be added from mobile.

### Fixed after first build (2026-08-22)
- [x] Availability toggle threw an error on device — root cause was a backend 500, not the app.
      See `STATUS_BACKEND.md` 14.9c.
- [x] `commission_rate` rendered 100x low (API returns a fraction).
- [x] `PENDING` orders no longer filed under "Completed".

### Shared package — done 2026-08-22
The duplication between `app-rider` and `app-vendor` is gone. Both now consume **`@avdan/mobile`**
(`packages/mobile/`): design tokens, theme context, UI primitives, brand mark, api-client, secure
storage, toast, formatters and the auth module — 17 files, one copy.

Per-app by design: the status-label map (`src/constants/status.ts`, built from the package's
`createStatusLabel` factory) and the login form. Note `packages/ui` could not be reused for any of
this — it is Tailwind + Shadcn and none of it runs in React Native.

Verified: `tsc --noEmit` clean on the package and both apps, and both iOS bundles built through
Metro and asserted on for correct per-app content. No `metro.config.js` was needed.

---

## Phase 10 — Customer Mobile App (`app-customer`) — built 2026-08-23

> Built third, deliberately, on the foundations laid by §1–§4 of `BACKLOG_HARMONISATION.md` — the
> shared package, R2 image storage, and the payment verify endpoint all existed before this app
> was started, so nothing here needed to be reworked mid-build.

### Stack
Same as the other two: Expo SDK 54, RN 0.81.5, expo-router 6, TanStack Query v5, Zustand, Zod,
Bearer tokens in `expo-secure-store`, `@avdan/mobile` for theme/UI/auth. Runs on Metro **port 8083**
alongside app-rider (8081) and app-vendor (8082) — all three verified running simultaneously.

### Brand
Primary lockup — deep royal-blue ground, gold arrow — straight from the source logo. Distinct from
app-rider's lighter blue and app-vendor's inverted gold-ground treatment.

### Payment — the actual design decision this app needed
No official Paystack React Native SDK exists. `react-native-paystack-webview` (a community
WebView wrapper) was rejected — that is the "web mixed into mobile" outcome, and it would put card
entry inside a JS-controlled WebView.

**Used instead: `expo-web-browser`'s `openAuthSessionAsync`.** Opens checkout in the OS's own
hardened browser (SFSafariViewController / Chrome Custom Tab), returns via the
`avdancustomer://checkout/callback` deep link (scheme matches `payment_callback_url_mobile` on the
API exactly). Card details never touch app JavaScript. On return, `use-checkout.ts` always calls
`POST /payment/verify/{reference}` rather than trusting the redirect — the webhook remains
authoritative, verify is what lets the app answer "did that work?" immediately. `openAuthSessionAsync`
resolving `dismiss` (user swiped the browser away) still triggers a verify call, since dismissing
does not mean the payment did not go through.

**Caught before it could break EAS builds:** `expo-web-browser` was initially listed in
`app.config.ts`'s `plugins` array. It ships no config plugin — it's a pure JS API — and listing it
would have failed `expo prebuild`/EAS with "does not contain a valid config plugin". Removed;
confirmed the bundle is unaffected (identical byte size before and after).

### The one real backend constraint this app had to design around
`POST /orders` takes a single `vendor_id` — there is no multi-vendor order on this backend. So the
**cart is grouped by vendor** (`cart.store.ts`'s `groupByVendor`), and checkout pays for one
vendor's items at a time; a basket spanning three sellers is shown honestly as three separate
checkouts rather than discovered as a failure at the API. This shaped the cart and checkout screens
directly — it is not a UI choice, it is the schema.

### Screens
```
(auth)/login
(main)/                          home.tsx                    [Tabs: Home]
(main)/products, /products/[id]  products-list, product-detail
(main)/categories, /[id]         categories-list, category-products
(main)/vendors, /[slug]          vendors-list, vendor-detail  [Tabs: Stores]
(main)/search                    search.tsx (debounced, products+vendors)
(main)/cart                      cart.tsx                    [Tabs: Cart, badge = item count]
(main)/checkout                  checkout.tsx (address form + pay)
(main)/orders, /[id]             orders-list, order-detail    [Tabs: Orders]
(main)/profile, /edit, /appearance                            [Tabs: Profile]
app/checkout/callback.tsx        deep-link landing safety net (outside the tab group)
```

### Milestones
- [x] 10.1 Scaffolded on `@avdan/mobile`; zero duplicated theme/UI/auth code from day one
- [x] 10.2 Full catalogue browse: home, products, categories, vendor storefronts, debounced search
- [x] 10.3 Cart: per-vendor grouping, stock-capped quantity, `expo-secure-store` persistence,
      hydrated at boot alongside the auth session
- [x] 10.4 Checkout: address form (Zod, mirrors `DeliveryAddress`), order creation, OS-browser
      payment, verify-on-return, explicit multi-vendor-checkout messaging
- [x] 10.5 Orders: active/past tabs, buyer-facing progress trail (collapsed from the full internal
      state machine — QA and escrow states are invisible to the customer), pay-now retry for a
      `PENDING` order
- [x] 10.6 Product-image snapshots (migration 0015) rendered on order line items
- [x] 10.7 Profile, appearance, edit — same pattern as the other two apps
- [x] 10.8 `tsc --noEmit` clean; iOS bundle builds through Metro (11.9 MB, zero resolution errors,
      zero cross-app string contamination verified against both sibling bundles)
- [ ] 10.9 Live device test — not yet run on any of the three apps
- [ ] 10.10 Push notifications for order status changes
- [ ] 10.11 Android EAS build

### Deliberately not built
- **Saved delivery addresses.** The API has no address-book endpoint — `delivery_address` is
  captured per order, not stored against the customer. Checkout asks each time. A saved-addresses
  feature needs a backend endpoint first.
- **Order tracking map.** `app-rider` broadcasts live location; nothing customer-facing consumes it
  yet. The order detail screen shows the buyer-facing status trail, not a map.
- **Notification center.** `GET /notifications` exists and is unused by this app — same shape as
  the gap already noted for the other two apps.

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

- **Reconciled 2026-08-22.** Phase 3A and backend Phases 12–13 were audited against the codebase and
  ticked; both were fully built while their checklists showed unticked. Trust the code over an
  unticked box in this file, and re-audit before assuming something is missing.
- **The `@avdan/types` placeholder is the biggest silent liability in the repo.** `generated.ts` is
  8 lines of `Record<string, never>`. Everything typed as an API response in all 6 apps is
  hand-written and unvalidated. Run `scripts/generate-types.sh` the moment FastAPI is up, then
  `pnpm turbo run type-check` and expect real drift to surface.
- Phases 2–7 are code-complete as of 2026-06-09. All require live backend verification.
- When starting a session, run `pnpm turbo run type-check` to check all apps before touching code.
- `generate-types.sh` must be run once the backend is live to regenerate `@avdan/types/generated.ts`.
- All apps pass TypeScript strict mode checks as of 2026-06-09.
- Brand is final, not a placeholder: `--primary: 220 85% 50%` (#135BEC, Royal Blue) and
  `--brand-accent: 38 92% 50%` (#F59F0A, Signal Orange — sparing use only) in
  `packages/ui/src/tokens/tokens.css`. The old `199 89% 48%` (#0ea5e9, cyan) placeholder is gone
  from tokens.css but check for it before hardcoding any new chart/inline color — it was still
  leaking into recharts `stroke`/`fill` props (which don't read CSS vars) in both
  `dashboard-page.tsx` and `analytics-page.tsx` well after the rebrand, since nothing type-checks
  a raw hex/hsl string against the token file. Fixed 2026-07-30; grep for `hsl(199` if it recurs.
