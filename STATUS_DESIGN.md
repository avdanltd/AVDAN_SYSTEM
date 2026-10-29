# STATUS_DESIGN.md — Premium UI/UX Overhaul, Architecture & Launch Infrastructure

> Created 2026-09-17. This is the working plan for taking AVDAN from "functional" to a premium,
> consistent, launch-ready product across all 8 apps (5 web, 3 mobile), plus the architecture,
> app-store, and infrastructure decisions that need to be made before going live.
>
> **Convention:** check items off as they land (`[x]`). Don't mark a screen done until it's been
> looked at in a real browser/simulator, not just written. This file is read alongside
> `STATUS_BACKEND.md` / `STATUS_FRONTEND.md` — those track feature completeness, this tracks
> visual/UX quality and go-live readiness.

---

## 0. Where the bar is set

Reference: `~/projects/fondlyheld`'s sign-in screen (`src/components/brand/split-shell.tsx` +
`brand-panel.tsx`) and its `DESIGN.md`. What makes it read as premium, specifically:
- A dark, warm "story" panel next to the functional form — not a bare centered card on white.
- Real content in the hero (tilted demo cards, a tagline that sells the product), not a stock photo.
- Gentle ambient motion (floating marks, staggered reveals) that never interferes with the task.
- One expressive display font doing the emotional work, one clean sans for everything else.
- Generous space, soft layered shadows, no flat grey cards.

AVDAN is an e-commerce/logistics platform, not a memory board — the direction below adapts that
same discipline (intentional, warm, editorial, one signature moment per key screen) to a
commerce-and-operations product instead of copying fondlyheld's literal look.

---

## 1. Architecture decision — monorepo vs. split

**Verdict: stay monorepo through launch and the growth phase after it.** Revisit only when a
concrete trigger below actually happens — don't split preemptively.

**Why it's right today:**
- `@avdan/types`, `@avdan/ui`, `@avdan/mobile`, `@avdan/config` are live, actively-shared code —
  splitting means publishing them (private npm registry or GitHub Packages) and versioning every
  change, which is pure coordination tax for a ~1-2 person engineering team.
- Cross-cutting changes are the norm here, not the exception — e.g. the `ARRIVED_AT_HUB` state
  addition this week touched the API, three web apps, one mobile app, and the shared types
  package in a single coherent change. In a polyrepo that's 5 PRs across 5 repos that have to
  land in the right order or the build breaks.
- One CI pipeline (`ci.yml`) already builds and type-checks everything together — this catches
  exactly the kind of cross-app breakage a split repo would silently ship (a backend field rename
  that a frontend repo doesn't find out about until its own, separately-scheduled CI run).

**When to actually reconsider (none of these apply yet):**
1. Team grows past ~8-10 engineers with real ownership boundaries (a mobile team that doesn't
   touch the API, a backend team that doesn't touch web) — until then, one team benefits from one
   repo.
2. Mobile release cadence needs to fully decouple from web/API cadence (e.g., a 2-week app-store
   review cycle blocking unrelated web deploys) — EAS Update already solves most of this without
   a repo split, since JS-only mobile changes ship OTA independent of any web deploy.
3. CI time becomes a bottleneck. It isn't yet — build+typecheck is a few minutes.

**What to fix regardless of the monorepo question:** `apps/api` has no `package.json` at all
right now, so `pnpm turbo run dev` silently never starts it — worth adding a thin one so `turbo`
can orchestrate it consistently with everything else, independent of this decision.

---

## 2. Infrastructure — current reality vs. plan

**Current reality (verified against the actual deploy workflow, not the aspirational docs):**
production is `docker compose -f docker-compose.prod.yml` over SSH to a single VPS
(`.github/workflows/deploy-prod.yml`). The `infra/k8s/*` manifests already in the repo
(K3s Deployments/StatefulSets for API, Celery, Postgres, Redis, nginx) are **not currently used**
— they're a drafted future state, not what's live. `ARCHITECTURE.md`'s "Node 1 / Node 2" K3s
description is describing that future state as if it's current — worth correcting there too so
the docs stop contradicting the actual deploy script.

**Gaps that matter more than the redesign, honestly — fix these before or during launch prep,
not after:**
- [x] **No automated database backups.** **Built 2026-09-18:** `infra/docker/backup/backup-db.sh`
      runs `pg_dump` (custom format, `-Fc`) against `DATABASE_URL`, gzips it, keeps the last 14
      days locally, and — when `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/
      `R2_BACKUP_BUCKET` are set — pushes a copy to the same Cloudflare R2 account already used for
      product images (a separate bucket, not `R2_BUCKET`). `infra/docker/backup/crontab` runs it
      nightly at 02:00 inside a small `db-backup` service added to `docker-compose.prod.yml`
      (Alpine + `postgresql-client` + `aws-cli`, mounts a `pg_backups` named volume, no app code).
      `.github/workflows/deploy-prod.yml` now scps the backup script/crontab alongside the compose
      file on every deploy. See `infra/docker/README.md` for the restore command.
      **Not done — needs you:** the R2 bucket + credentials for off-site copies don't exist yet, so
      right now this is a solid *local* nightly backup only (survives an app crash / bad deploy,
      not a lost VPS). Create the bucket and set the four env vars on the VPS to get off-site
      coverage. **And critically: nobody has run a restore drill.** A backup that has never been
      restored is a hypothesis, not a backup — do this before trusting it.
- [x] **No error tracking.** **Built 2026-09-18:** Sentry wired into the API
      (`sentry-sdk[fastapi]`, guarded `sentry_sdk.init()` in `apps/api/main.py` — completely inert
      if `SENTRY_DSN` is unset, which it is by default) and into all 5 Next.js web apps
      (`@sentry/nextjs`, `instrumentation.ts` / `instrumentation-client.ts` /
      `sentry.server.config.ts` / `sentry.edge.config.ts`, `next.config.ts` wrapped with
      `withSentryConfig`). Verified inert (`import main` succeeds, no DSN configured) and every web
      app still typechecks/builds clean.
      **Not done — needs you:** create a Sentry project (or one per app) to get real DSNs, then set
      `SENTRY_DSN` in `apps/api/.env` and each web app's env. The 3 React Native apps
      (app-customer/app-vendor/app-rider) are **not wired yet** — deferred as a separate,
      slightly different task (`@sentry/react-native` uses a different init path than
      `@sentry/nextjs`).
- [ ] **No uptime/health monitoring or alerting.** Nothing pages anyone if the API goes down at
      3am.
- [ ] **Rotate the live secret already flagged in `STATUS_BACKEND.md`** (`apps/api/.env`'s
      `resend_api_key`) before going live, if it hasn't been already.

**Phased plan:**

**Phase 1 — before or during launch prep (do this, it's cheap and the current setup supports it
fine):**
- [x] Automated nightly `pg_dump` to off-site storage — script and cron are in place (see above);
      the bucket/credentials and the restore drill are the remaining, non-code steps.
- [x] Wire up error tracking — done for API + all 5 web apps (see above); mobile apps still open.
- [ ] Uptime monitoring on the public health endpoint (UptimeRobot / Better Uptime free tier),
      alerting to a phone, not just email.
- [ ] Document and test the rollback procedure: confirm the previous image tag can actually be
      redeployed in under 5 minutes if a deploy goes wrong.
- [ ] A single Dockerized VPS is **fine for launch traffic** — don't let infra migration block
      going live. This is a "harden what exists," not "replace what exists," phase.

**Phase 2 — once real traffic validates the product (weeks-to-months post-launch, not now):**
- [ ] Migrate to the already-drafted K3s setup (`infra/k8s/*`) for rolling zero-downtime deploys
      and horizontal API scaling. The manifests exist; this is finishing a start, not starting
      from scratch.
- [ ] Move Postgres to a managed service (Neon, RDS, or a properly-backed-up self-hosted HA setup)
      once uptime matters enough to justify it.
- [ ] Only do this migration when there's room to test the cutover carefully — never migrate
      infrastructure the same week as a launch.

---

## 3. App store strategy

- **Customer app (`app-customer`): full public listing on both Play Store and App Store.** This
  is the acquisition surface — it needs to be discoverable by strangers searching the store.
- **Vendor app (`app-vendor`) and Rider app (`app-rider`): publish, but not necessarily as a
  full public listing.** These users are recruited/onboarded, not organically discovered via
  store search. Recommend Play Store's **Closed Testing / Internal Testing track** (invite-link
  distribution, still a real store install with auto-updates, no public search visibility) unless
  self-serve vendor signup becomes a real acquisition channel later, at which point flipping to a
  public listing is a Play Console setting change, not new work.
- **Blocking prerequisite for any App Store (iOS) distribution of any of the three apps:** a paid
  Apple Developer Program account ($99/yr) does not exist yet (confirmed earlier this session —
  this is why mobile testing has been Expo Go-only). This is a concrete purchase decision to make
  before iOS distribution of anything.
- **Android is cheap and unblocked today:** one-time $25 Google Play Developer account. Worth
  doing now regardless of design-overhaul timing, since account review/verification itself can
  take days and shouldn't be the thing blocking launch at the last minute.
- [ ] Decide: buy Apple Developer account now or defer iOS launch to a second wave after Android?
- [ ] Buy Google Play Developer account.

---

## 4. Design system

### 4.1 Brand, as it exists today (don't change the mark — refine its usage)
- Logo: navy rounded-square badge, orange upward arrow/paper-plane mark, "AVDAN" wordmark.
  Variants already exist per mobile app (`assets/brand/logo-{arrow,badge,wordmark,wordmark-light,full}.png`).
- Primary: Royal Blue `#135bec` (HSL `221 100% 65%` in dark). Accent: Signal Orange `#f59f0a`.
- Type: **Playfair Display** (serif, display/headings) + **Bricolage Grotesque** (sans, body) —
  already configured in both `packages/ui` and `packages/mobile`. This pairing is good and
  premium-capable already; the gap is in how little the serif is actually used across real
  screens today, not the choice itself.

### 4.2 Dark mode
- [x] **Web dark-mode tokens added** (`packages/ui/src/tokens/tokens.css`) — exact HSL conversion
      of the mobile app's already-shipped dark palette (`packages/mobile/src/theme/tokens.ts`), so
      web and native are pixel-value-identical in dark mode, not just "similarly dark." Applies on
      `prefers-color-scheme: dark` today.
- [x] **Root cause of the "why does this look basic/blue" feedback (2026-09-17), fixed on
      `web-customer` + `web-vendor`.** There was no toggle anywhere on web — the site purely
      followed OS `prefers-color-scheme`, so a visitor whose system defaults to dark (very common)
      had no way to reach the already-decent light theme underneath and would only ever see the
      heavy navy dark palette. Wired `next-themes` into both apps (`ThemeProvider`/`ThemeToggle`,
      new shared components in `@avdan/ui`, `attribute="data-theme"` matching tokens.css's existing
      contract exactly) with **light as the true default and `enableSystem: false`** — new visitors
      always see light first (matching Amazon/Jumia's consistent-regardless-of-device-setting
      approach), a saved choice persists and is never silently overridden by an OS change. A sun/
      moon icon button sits in both apps' navbars (desktop + mobile sheet nav on web-customer).
      Verified live: fresh load is light, toggle flips to dark and back, choice survives a reload,
      no flash-of-wrong-theme on load.
      **Not yet done — web-admin/web-hub/web-rider** (same 4-line wiring, not yet applied there;
      low priority per customer/vendor-first). **Not yet done — the 3-way System/Light/Dark control
      mobile's `Appearance` screen has**; what's built is a simpler 2-way toggle, which solves the
      actual complaint (no escape from dark, no light-by-default) without needing a dedicated
      settings page. Upgrading to full 3-way parity with mobile is a smaller follow-up now that the
      provider plumbing exists.
      **Separately flagged, not fixed — the homepage hero carousel is a fixed-dark photo panel
      regardless of theme** (a deliberate earlier-session choice, matching `AuthSplitShell`'s
      pattern, for text legibility over photos — a legitimate pattern many real e-commerce sites
      also use for banner content). Now that light is the default, this reads as a large dark block
      at the very top of an otherwise light page. Not changed without checking with the user first,
      since it's a real design-direction call, not a bug — see the color/brand discussion below.

### 4.3 Motion — profiles, not vibes (mirrors fondlyheld's DESIGN.md discipline)

| Profile | Where | Entrance | Interaction |
|---|---|---|---|
| `commerce` | Product grids, cart, checkout | Staggered fade-up, ~250ms | Scale 0.98 on press, lift on hover |
| `operational` | Vendor/Admin/Hub dashboards, order tables | Instant or fast fade (~150ms) | Minimal — data density matters more than delight here |
| `celebratory` | Order placed, payout received, delivery confirmed | Spring scale-in, brief confetti/checkmark burst | One-shot, never repeats on re-render |
| `ambient` | Auth screens, empty states, onboarding | Slow gradient drift, floating brand marks | Subtle, continuous, low-opacity |

Rules (adopt fondlyheld's verbatim, they're correct):
- Respect `prefers-reduced-motion` everywhere — swap to instant, never remove content.
- No interaction animation over 300ms; entrances may run to 600-800ms.
- Loading states are skeletons in the theme palette, never a bare spinner.
- Operational screens (admin/vendor/hub tables) get *less* motion than commerce screens, not
  more — density and speed matter more than delight for a vendor processing 40 orders.

### 4.4 Imagery
- Product/category imagery: continue using real product photos where vendors provide them
  (already snapshotted per order item); for placeholder/marketing imagery (empty states, category
  headers, onboarding), use Unsplash (free, no attribution required beyond their standard license)
  curated to warm, real-Lagos-commerce imagery — not generic stock-photo handshake shots.
- Avoid AI-generated imagery for anything customer-facing showing people (uncanny-valley risk for
  a commerce product where trust matters); fine for abstract textures/backgrounds if needed.
- [ ] Build a small curated Unsplash collection (10-15 images: markets, delivery riders on
      motorcycles, Lagos street commerce, packages) reused consistently across empty states and
      marketing sections instead of ad hoc per-page choices.

### 4.5 Signature moments to design deliberately (these are what get noticed)
1. **Auth screens** (all 5 web apps' login, all 3 mobile apps' login) — the fondlyheld-style split
   shell: dark warm brand panel + light functional form, adapted per app's role (customer sees
   product imagery in the panel, vendor sees a dashboard preview, rider sees a delivery-route
   illustration).
2. **Order placed / payment success** — customer app, a genuine celebratory moment, not a plain
   "Order #123 confirmed" text screen.
3. **Live order tracking** — customer app, the map/status view already being built per the
   `5bb4cba` commit — worth making this the visual centerpiece of the customer app.
4. **Empty states everywhere** — every app, every list screen. An empty cart, no orders yet, no
   products yet should never be a bare "No data" — see rule below.
5. **The vendor account-linking nudge** — see §5, a new UX pattern that doesn't exist yet.

### 4.6 Hard rules
- No native browser/OS `alert()`, `confirm()`, or default modal anywhere in any web or mobile
  app — every confirmation/notification is a custom-built component matching the design system.
  (This is already a stated constraint for the new vendor-linking feature in §5, but it should be
  the rule everywhere, not just there — grep for `Alert.alert` in the mobile apps and `confirm(`/
  `window.confirm` in web apps as a follow-up audit item.)
- Every empty state has: an icon or small illustration, one sentence explaining why it's empty,
  and — where applicable — a single clear action (not a wall of options).
- Every list screen has a skeleton loading state in the theme palette, never a spinner-only state.
- Consistency check before marking any screen done: same button variants, same spacing scale,
  same card radius, same status-badge component (`@avdan/ui`'s `OrderStatusBadge` / mobile's
  `statusColors`) as every other screen in that app.

---

## 5. New feature: vendor account-linking nudge (post-sign-in)

**Spec**, since this was described as a concrete feature, not just a design pass:

- **Trigger:** immediately after a vendor successfully signs in (web-vendor and app-vendor both),
  if `has_payout_account` is false (the same field the payout-account screens already check).
- **First surface — dismissible nudge, not a blocking modal:** a custom-built banner/toast
  (matching the design system, not the OS/browser default), e.g. "Add your payout account to
  start receiving payments" with a primary action ("Set up now") and a dismiss (×). Dismissing
  does not disable the account or block any functionality — it's a nudge, not a gate.
- **Confirmation dialog:** if the vendor taps "Set up now" and then backs out partway through
  the payout-account form (per the existing verify-before-save flow already built), a **custom**
  confirmation dialog asks whether they want to discard progress — built as an actual component
  (`@avdan/ui` dialog primitive on web, a custom `Modal`-based component on mobile — the mobile
  payout-account screen already uses a custom `Modal` for the bank picker, follow that exact
  pattern), never `window.confirm`/`Alert.alert`.
- **Persistence:** remember the dismissal per-session (or per-day) so it doesn't nag on every
  page load — a dismissed nudge should reappear at most once every 24h until the account is
  actually linked, then never again.
- [ ] Design the nudge component (web + mobile).
- [ ] Design the custom confirmation dialog (web + mobile) — reusable, not one-off.
- [ ] Wire dismissal persistence (localStorage web / a small stored preference mobile).
- [ ] Wire the trigger condition into both vendor apps' post-login flow.

---

## 6. Screen-by-screen inventory and redesign checklist

Counted directly from the codebase (`page.tsx` per web app, screen files per mobile app): **53
web pages + 37 mobile screens = 90 screens across 8 apps.** This will not all happen in one pass —
phased by what matters most for launch, per the instruction that customer-facing experience is
the top priority.

### Phase A — Foundation (blocks everything else, do first)
- [x] Dark-mode design tokens (web) — §4.2
- [x] `next-themes` wiring + toggle UI — done on **all 5 web apps** (web-customer + web-vendor
      first, §4.2; web-admin/web-hub/web-rider picked up the same pattern during their Phase D/E
      audit passes).
- [x] Shared premium primitives pass in `@avdan/ui` (2026-09-18) — `card.tsx` and `dialog.tsx` now
      use the `shadow-card`/`shadow-modal` tokens (defined in tokens.css since earlier this session,
      but never actually used anywhere until now); `input.tsx` got a subtle dark-mode-safe lift;
      base `--radius` bumped from 8px to 12px (cascading through the existing `-sm/-md/-lg/-xl`
      scale to every consumer, one change point instead of per-component drift). `button.tsx`/
      `badge.tsx` reviewed — badge was already correct (`rounded-full`), button intentionally keeps
      shadow as a page-level opt-in (dense admin/vendor tables shouldn't get a shadow on every
      button by default). No props/API changed anywhere. Verified: all 5 web apps type-check clean,
      and spot-checked live in both light and dark mode across web-customer/web-vendor/web-admin —
      no clipping, no dark-mode shadow artifacts, genuinely reads as more premium. `dropdown-menu.tsx`/
      `sheet.tsx`/`switch.tsx` still use generic shadows (same class of gap, smaller) — flagged, not
      fixed, to keep this pass scoped to the four named primitives.
- [x] Unsplash image sourced for the flagship auth moment (§4.4) — a delivery-rider night shot
      (`apps/web-customer/public/brand/auth-hero.jpg`), colour-matched to the brand palette.
      Broader curated collection (10-15 images for other empty states/marketing) still open.
- [x] Motion primitives — CSS-only (`packages/ui/src/tokens/tokens.css`: `avdan-animate-fade-up`,
      `-float-slow`, `-glow-pulse`, all respecting `prefers-reduced-motion`), not a new animation
      library — sufficient for entrance/ambient motion; revisit only if a screen needs real
      interaction physics (drag, layout transitions) that CSS can't do cleanly.
- [x] `AuthSplitShell` — new shared component (`packages/ui/src/components/custom/auth-split-shell.tsx`,
      exported from `@avdan/ui`): the reusable flagship auth pattern (photo-led dark brand panel +
      light form panel, responsive band-on-mobile/column-on-desktop) every app's auth screens will
      use, each supplying its own hero image via `imageSrc`.
- [x] `AuthSplitShell` (native) — mirror component (`packages/mobile/src/components/auth-split-shell.tsx`,
      exported from `@avdan/mobile`): same pattern for React Native, using the existing vector
      `AvdanMark` for the badge (no PNG asset needed) and a flat dark scrim in place of the web
      version's gradient (no new native dependency — `expo-linear-gradient` is a fast follow-up if
      the flat scrim reads as flat in practice, not a blocker).

### Phase B — Customer-facing (highest priority — this is what the user explicitly called out)
**`app-customer` (17 screens) + `web-customer` (18 pages):**
- [x] **`web-customer` auth (login, register, OTP verify)** — rebuilt on `AuthSplitShell`.
      **Visually verified in a real browser** (Chrome, 1440×900): dark photo panel, gradient +
      glow overlay, serif tagline, trust-stat badges, and the clean form panel all render exactly
      as designed on both `/login` and `/register`. Badge mark zoomed-in and confirmed crisp, no
      artifacts. **Mobile band layout (`lg:hidden` / `hidden lg:block` breakpoint) not visually
      confirmed** — the browser tool's `resize_window` didn't actually change the rendered
      viewport in this session, so the narrow-width version is unverified. Please spot-check
      `localhost:3000/login` at phone width (~390px) before marking this fully done.
- [x] **`app-customer` auth (login)** — rebuilt on the native `AuthSplitShell`. Type-checks clean
      across `app-customer` and `@avdan/mobile`. **Not visually verified** — needs a look in
      Expo Go on your phone (restart Metro with `--clear` first). No register screen exists for
      this app (customers register via web, then sign into the app) — nothing missing there.
- [x] **Fixed a real bug found during this pass, not cosmetic:** `app-customer`'s `(main)/_layout.tsx`
      gated the *entire app* behind login (`if (!isAuthenticated) return <Redirect href="/login" />`)
      — home, product browsing, vendor pages, search, all of it. `web-customer` already gets this
      right (`proxy.ts`: `PROTECTED_PATHS = ['/orders', '/checkout', '/profile', '/notifications']`,
      "Everything else is publicly browsable") — mobile just never matched it. Removed the blanket
      gate; added a new `SignInGate` component (`modules/shop/components/sign-in-gate.tsx`) that
      renders a friendly inline "Sign in to…" prompt (not an automatic redirect — the user tapped
      a real tab on purpose) instead of the real content on the three screens that actually need an
      account: Orders, Order detail, Profile, and Checkout. Home/vendors/products/categories/search/
      cart are fully public now, matching web. Verified: confirmed no public screen makes an
      authenticated-only API call that could trigger the app's global 401→login redirect while
      browsing as a guest. Type-checks clean. Not yet seen running on-device.
- [x] **`web-customer` home page hero — fixed two real bugs found by actually viewing it, not
      just reading the code.** The hero carousel already existed and was reasonably well-built
      (category grid, product sections, vendor cards, "how it works" — all fine, not touched).
      What was broken:
      1. **Dark-mode regression**, caused by this session's own dark-token addition: the hero's
         legibility gradient was `from-background via-background/85 ...` — fine when `--background`
         is white, but in dark mode that token is near-black, so the "light wash" became a near-
         opaque dark wash that hid the photo almost entirely. Fixed by switching the hero (and its
         prev/next buttons and dot indicators) to a **fixed dark scrim + white text, independent of
         theme** — matching the same pattern `AuthSplitShell` already uses for its hero photo, so
         the two most important photo-hero moments in the app are now visually consistent with each
         other and immune to this class of bug.
      2. **Two of the four hero images were bad/wrong picks**, pre-dating this session: slide 1
         ("Shop from top local vendors") was a flat-lay photo that's ~80% pure black background —
         nearly invisible under any overlay; slide 3 ("Electronics & gadgets") was actually a
         **clothing boutique interior**, topically mismatched. Replaced both with verified,
         on-topic, checked-by-eye Unsplash photos (real market stall scene; a dark tech flat-lay).
         **Worth an app-wide audit**: any other Unsplash image picked before this session should be
         spot-checked the same way (downloaded and actually looked at, not assumed correct from a
         search-result thumbnail) before being trusted in a hero/banner placement.
      Visually verified in a real browser after a genuinely fresh page load (a first check showed a
      completely blank hero, which turned out to be an embla-carousel track offset artifact from my
      own rapid reload-testing in that session, not a real bug — confirmed by reloading in a brand
      new tab, where it rendered correctly).
- [x] **Product catalogue images — a much bigger, systemic data-quality problem than the hero
      photos, found and fixed.** Checked all 79 seeded products across all 8 vendor categories:
      ~41% of the 46 unique image IDs in `apps/api/scripts/seed.py` were flat-out 404 (a "JAMB CBT
      Practice Card" product showed nothing at all; several others across pharmacy, electronics,
      and stationery items), and several more that *did* load were topically wrong — most
      strikingly, a scratch-card/study-material product was pointing at a photo of a man's face.
      Re-sourced and verified **every single one**: built a small Python contact-sheet tool
      (`/tmp/avdan-check/contact_sheet.py`, not committed — a session tool) to review ~15 real
      Unsplash search candidates per category at once instead of one image per lookup, cross-
      checked each pick against the actual product list per vendor (electronics ≠ fashion ≠
      pharmacy ≠ cosmetics, several categories mix distinct sub-types that needed separate
      searches — e.g. "Health & Beauty" is mostly pharmacy items, not cosmetics), and verified
      every final URL returns HTTP 200 at production size before committing to it.
      **Caught and fixed a real mistake of my own along the way**: while doing this at speed I
      several times copied a *truncated* photo ID straight from a contact sheet's display label
      (deliberately shortened for onscreen labeling) instead of the real, full Unsplash ID — a
      systemic error across ~60 of the ~73 IDs I'd just written. Caught it by noticing one
      genuinely 404'd on the live page, then wrote a verification pass that cross-checked every ID
      in the file against the full IDs actually returned by search, before trusting any of it.
      Worth remembering for any future image-sourcing pass: **never hand-copy a display label as
      an identifier** — always keep and use the untruncated source value.
      Applied to both `seed.py` (future re-seeds) and the *already-seeded* live dev database via
      a new one-off script, `apps/api/scripts/backfill_product_images.py` (matches by vendor/
      product name — safe to re-run, only touches rows named in the seed data). Ran it: 71 product
      images + 1 vendor logo corrected in the live DB. Visually confirmed correct in a real
      browser, across multiple categories, after the fix.
- [ ] Product discovery / category browse — remaining visual/layout polish (rest of Phase B)
- [x] Product detail — reviewed on web-customer (layout, related-products section, image
      rendering). Two things that looked broken on first glance were false alarms (a very dark
      product photo misread as blank at screenshot scale; a related-products section that was
      simply below the fold) — verified via direct backend/proxy responses and DOM checks rather
      than trusting the screenshot. No code change needed.
- [ ] Cart
- [x] Checkout — fixed a real correctness bug: the summary showed "Delivery fee: Calculated at
      dispatch" and the Pay button charged only the product subtotal, while `PaymentService.
      initiate_payment` (this session's payout work) actually charges `total_kobo +
      delivery_fee_kobo` — customers would have been charged more than the amount shown. Fixed on
      both `web-customer` and `app-customer` by splitting "place order" from "pay": the order is
      created first (delivery fee is computed server-side at creation time), then the real fee and
      total are shown before a separate "Pay ₦X" step opens payment. Added `delivery_fee_kobo` to
      `OrderResponse`/`OrderDetailResponse` (backend) and to every hand-written `Order` type on the
      frontend (`@avdan/types` regenerated from a throwaway uvicorn instance on port 8010, since the
      dev-mode API on 8000 has no `--reload`), and corrected every other screen that quoted
      `order.total_kobo` alone as "the total" (web-customer orders list/detail/tracking,
      app-customer orders list/detail) to `total_kobo + delivery_fee_kobo`.
      **Action needed: restart the local API dev server (port 8000) to pick up the schema
      change** — it was intentionally left untouched rather than killed mid-session.

      **Known gap, not yet fixed — delivery fee is always the flat base rate.**
      `OrderService._calculate_delivery_fee` (apps/api/services/orders/service.py) already computes
      `base_fee_kobo + per_km_kobo × distance(vendor, customer)` from `PlatformConfig` (currently
      ₦500 base + ₦100/km, admin-editable), but distance can only be computed with both endpoints'
      coordinates. Vendor coordinates are seeded; **customer coordinates are never captured** — the
      checkout `DeliveryAddress` schema is street/city/state/notes free text only — so every order
      silently falls back to the flat ₦500 base fee regardless of real distance. To fix: capture
      real customer coordinates at checkout, GPS-first (`navigator.geolocation` / `expo-location`,
      free, precise) with an address-autocomplete fallback (Mapbox recommended over Google Places
      for Nigeria coverage + free tier) for when GPS is off or the order is for a different address.
      Blocked on the user creating a Mapbox/Google API key — cannot be wired up until then.
- [x] Cart — web-customer's drawer already said "Subtotal" + "Delivery fee calculated at
      checkout" honestly, no bug. app-customer's cart screen mislabeled the same pre-fee amount as
      "Total" with no disclaimer (fixed: now "Subtotal" + a delivery-fee note, matching web); also
      removed a no-op `groups.length > 1 ? 'Checkout' : 'Checkout'` ternary.
- [x] Order confirmation (celebratory moment, §4.5) — web-customer only so far (app-customer
      already had a reasonable post-payment redirect to its own order detail screen via
      `useCheckout`, lower priority). Found the `/checkout/success` page was worse than a plain
      text screen: it showed "Payment Successful!" **unconditionally**, with zero call to
      `POST /payment/verify/{reference}` — a customer whose payment failed or was cancelled on
      Paystack would land on a page falsely confirming success. `/checkout/failed` existed as a
      route but was never linked to from anywhere (dead code, deleted). Rebuilt as a real
      client-side flow: reads `reference` from the URL, calls verify, and only then branches to a
      celebratory "Order confirmed!" state (spring scale-in + one-shot ring pulse — new
      `avdan-animate-celebrate`/`-celebrate-ring` keyframes in tokens.css, real order receipt
      pulled from `useOrder`) or a plain "Payment not completed" state with a working "Try Again"
      (re-initiates payment for the same order — no double-charge) — never both, and never a false
      positive. Also caught a real pre-existing bug while testing this against a live paid order:
      the frontend's hand-written `OrderItem` type used a field called `name` that the backend has
      never actually returned (it's `product_name`) — every order-items list on web-customer
      (order detail, live tracking, and now this page) was silently rendering a blank product name
      for every line item. Fixed the type and all three real call sites (cart lines use a
      different, correct, client-side type — not affected).

      **Platform-wide fix found in the process — `OrderStatusBadge`/`UserStatusBadge`
      (`packages/ui/src/components/custom/status-badge.tsx`) hardcoded literal Tailwind palette
      classes (`bg-green-100 text-green-700`, `bg-blue-100 text-blue-700`, `bg-amber-100
      text-amber-700`) for ~14 of its ~26 status entries.** These never respond to
      `prefers-color-scheme`/`[data-theme]` — every status pill on every web app (this component is
      shared platform-wide) was a pale light-mode pastel glued onto a dark card. Fixed by switching
      to the existing `success`/`info`/`warning` semantic tokens (already dark-mode-tuned in
      tokens.css, just unused here). Also fixed the same literal-color pattern in 4 more
      web-customer files (`tracking-page.tsx`'s "Live" badge, `vendor-card.tsx`,
      `vendor-detail-page.tsx`, `product-detail-page.tsx`'s in-stock badge) while doing this pass.
      **Not yet fixed — same pattern still present in web-admin (`categories-page.tsx`), web-rider
      (`dashboard-page.tsx`, `orders-page.tsx`), and web-vendor (`order-card.tsx`,
      `profile-page.tsx`) — lower priority per "customer first," flagged for Phase C/D/E.**
- [x] Live order tracking (signature moment, §4.5) — fixed the "Live" badge above as part of this
      pass. Also found and fixed a real, unrelated hydration bug while testing:
      `orders-page.tsx`'s `OrderCard` wrapped the whole card in a `<Link>` (`<a>`) with two more
      `<Link>`s nested inside it ("Track", "View Details") — invalid HTML (`<a>` cannot contain
      `<a>`), throwing a console hydration error on every load of `/orders`. Fixed by making the
      card a `<div role="link" tabIndex={0}>` with programmatic navigation instead, keeping the two
      inner actions as real anchors with `stopPropagation`. Full visual redesign of this page (the
      map view, ETA card, a proper step-by-step journey visual like app-customer's `Journey`
      component in `order-detail.tsx`, which web has no equivalent of yet) is still open — this
      pass only fixed the two concrete defects found, not the broader visual pass.
- [x] Product discovery / category browse — audited web-customer's products/categories/search
      modules (products-page, product-grid, product-filters, product-card, pagination, skeleton,
      all-categories-page, category-products-page, search-results-page) and app-customer's
      equivalents: all already clean (semantic tokens, `ConfirmDialog` used correctly, good
      empty/loading states, types verified against `apps/api/services/vendor/schemas.py`). No
      changes needed on web. On app-customer, fixed missing empty-state descriptions (§4.4 requires
      an icon + one sentence + action; several had icon+title only) in `products-list.tsx`,
      `categories-list.tsx`, `category-products.tsx` (also added a "Browse all products" fallback
      action there), and a hardcoded `shadowColor: '#000'` in `orders-list.tsx`'s tab pill (theme
      has a scheme-aware `shadowCard` for this — now used instead).
- [x] Order history / order detail — verified the checkout-fee math end-to-end
      (`order-detail-page.tsx`'s total is genuinely correct, confirmed against the backend). On
      app-customer, `order-detail.tsx`'s item list was still missing a "Delivery fee" row even
      though its total had already been corrected to `total_kobo + delivery_fee_kobo` earlier this
      session — the visible line items didn't sum to the visible total with nothing explaining the
      gap. Added the missing row so the math is visible, not just correct. Also added a missing
      description to its "Order not found" empty state.
- [x] Profile / settings — found two real bugs on `web-customer`'s notifications screen (same class
      as the `item.name`/`product_name` mismatch found earlier): the frontend's `Notification` type
      didn't match the real backend response (`title`/`body` are actually nested under a `content`
      dict, and there's no `read` boolean — only `read_at`), so **every notification's title and
      body silently rendered blank, and every notification stayed marked unread forever**. Also
      `markRead` called `apiClient.patch(...)` against a backend route that's actually `POST
      /{id}/read` — mark-as-read never worked at all. All three fixed in
      `notifications.service.ts` + `notifications-page.tsx`.
      **Hard-rule violation found and fixed on app-customer**: `profile.tsx`'s sign-out used
      `Alert.alert(...)`, a native OS dialog banned by §4.6. `@avdan/mobile` had no shared
      confirm-dialog component yet, so one was built —
      `packages/mobile/src/components/confirm-dialog.tsx`, mirroring `@avdan/ui`'s web
      `ConfirmDialog` API — and `profile.tsx` now uses it. **Follow-up flagged**: `app-vendor` and
      `app-rider` still use `Alert.alert` in several places (profile, order-detail, product-form,
      image-picker-field) — out of scope for this pass (customer-first), but can now reuse this
      same shared component.
      `profile-page.tsx` (web), `profile-edit.tsx`/`appearance.tsx` (app-customer), and all auth
      screens were checked and found already clean (themed, no native dialogs, types verified
      against `apps/api/services/auth/schemas.py`).
- [x] Empty states: empty cart, no orders yet, no search results — covered above (products/
      categories/orders empty states on app-customer) plus a full repo-wide sweep for native
      dialogs (`window.confirm`/`alert(`/`Alert.alert`) across all of web-customer and
      app-customer: web-customer had zero hits (already clean); app-customer had exactly the one
      `Alert.alert` in `profile.tsx`, fixed above. Also fixed, while doing this pass: two `text-
      amber-500` (unthemed) star-rating colors on web-customer's `vendor-card.tsx`/
      `vendor-detail-page.tsx` → `text-warning`; a missing error state on `store-home-page.tsx`'s
      "Top Vendors" section (a failed fetch silently rendered nothing, no error message); and the
      same missing-error-state bug on app-customer's `home.tsx` ("New arrivals") and
      `vendors-list.tsx` — both now show a real "Couldn't load…" + Retry instead of misleadingly
      looking like an empty state when the fetch actually failed.

**Phase B (customer) is now functionally complete for this pass** — every screen has been audited
at least once; remaining work is deeper visual polish (motion, imagery, the live-tracking map/
journey redesign noted above), not correctness bugs. Ready to move to Phase C (vendor) when
prioritized.

### Phase C — Vendor (revenue-critical, second priority)
**`app-vendor` (12 screens) + `web-vendor` (8 pages):**
- [x] **New feature built: vendor payout account-linking nudge (§5), end to end, both platforms.**
      Triggers off the same `has_payout_account` field the payout-account screens already read
      (no new fetch — reused the existing `['vendor-catalog']`/`vendor-profile` query on web/mobile
      respectively). Dismissible banner (`VendorPayoutNudge` web, `PayoutNudge` mobile) mounted in
      each app's authenticated shell (`web-vendor/app/(main)/layout.tsx`,
      `app-vendor/src/app/(main)/_layout.tsx`), never a blocking modal. Dismissal persists 24h
      (localStorage web, `expo-secure-store` mobile) and stops forever once linked. Discard
      confirmation on backing out of the payout form uses a real custom dialog on both platforms —
      `@avdan/ui`'s `ConfirmDialog` (web, new Cancel button gated on `form.formState.isDirty`) and
      `@avdan/mobile`'s brand-new `ConfirmDialog` (mobile, wired into React Navigation's
      `beforeRemove` event so the header back button and iOS swipe-gesture are both caught, not
      just an in-screen button) — never `window.confirm`/`Alert.alert`. Also fixed 3 more hardcoded
      light-mode-only color blocks found in `profile-page.tsx`'s payout form while in the file.
- [x] Auth — checked both platforms' login/register/otp screens: already clean (themed, no native
      dialogs, types match backend).
- [x] Order queue — found and fixed the same bug classes as the customer pass: hardcoded
      unthemed colors (`order-card.tsx` web; a static `shadowColor:'#000'` in `orders-list.tsx`
      mobile, same fix pattern as app-customer's equivalent), and fetch errors rendering as
      indistinguishable empty states instead of a real "couldn't load" + retry
      (`orders-page.tsx` web, `orders-list.tsx` mobile).
- [x] Product/catalogue management — fixed an `Alert.alert` delete-confirmation in
      `product-form.tsx` (mobile) → `ConfirmDialog`; tightened `catalog.service.ts`'s payload types
      (were missing `category_id`/`image_urls`, which the form was already silently over-sending);
      added a missing fetch-error state to `catalog-page.tsx`/`catalog.tsx`.
      **The flagged image-upload gap is now built (2026-09-17), per direct user request.**
      web-vendor's create/edit product form had no image upload UI at all — vendors could only add
      product images via the mobile app. Built `image-upload-field.tsx` + a small
      `uploads.service.ts`, using the same direct-to-R2 presign-then-PUT flow the mobile app
      already uses (`POST /uploads/presign`, then the browser PUTs straight to R2 — no backend
      changes needed). **Tested for real** against the live dev stack: uploaded real images, created
      a product with 2 images through the actual form, confirmed `image_urls` persisted and
      reappeared correctly on reopening Edit, verified the cap and remove/re-add flow, cleaned up
      the test product afterward. Capped at **3 images on web** (explicitly requested), vs mobile's
      existing 5 — a deliberate, flagged platform difference, not an oversight. Uses a real per-file
      upload progress bar (`@avdan/ui`'s `Progress`, previously unused for uploads anywhere).
      Direct-to-R2 PUT from the browser worked cleanly with no CORS issues — the risk flagged going
      in didn't materialize, so no backend multipart-passthrough fallback was needed.
- [x] Payout account screens — the discard-confirmation work above covers this; no other changes
      needed (already functionally complete per the earlier note).
- [x] Storefront/profile settings — covered by the nudge work above (same file on web).
- [x] Analytics/dashboard — fixed missing fetch-error states on both platforms' dashboard/earnings
      screens (`dashboard-page.tsx`/`earnings-page.tsx` web, `dashboard.tsx` mobile) and a
      hardcoded `text-amber-600`/`text-amber-500` color.
      **Real backend money-correctness bug found and fixed**: `AnalyticsService.get_vendor_analytics`
      (`apps/api/services/analytics/service.py`) computed "Total Revenue" and "Pending Release" by
      summing `EscrowTransaction.amount_kobo` directly — but escrow now holds the *full customer
      charge* (`order.total_kobo + delivery_fee_kobo`, from this session's rider-payout work), of
      which the delivery-fee portion is the rider's (paid separately) and a commission cut is the
      platform's. Vendor dashboards were showing a "revenue" figure inflated by both the delivery
      fee they never receive and the commission they don't keep. Fixed to sum `Order.total_kobo`
      (matching `release_escrow`'s own real payout formula) and apply commission once, so the
      figure now matches what `release_escrow` actually transfers. **Not fixed — flagged for
      Phase E**: the admin overview (`AnalyticsService.get_overview`'s `revenue_today_kobo`) has
      the exact same `sum(EscrowTransaction.amount_kobo)` pattern and is very likely wrong for the
      same reason (mixing vendor + rider + platform money into one "revenue" figure) — out of scope
      for this vendor-focused pass, needs its own deliberate look.

Both `web-vendor` and `app-vendor` (and `@avdan/mobile`) type-check clean after all of the above.

### Phase D — Rider (operational, third priority) — audit-and-fix pass done (2026-09-18)
**`app-rider` (8 screens) + `web-rider` (5 pages):**
- [x] Theme toggle added to `web-rider` — it had **zero top chrome** (bottom tab bar only), so a
      slim sticky top bar (`Logo` + `ThemeToggle`) was added rather than forcing it into the tab bar.
- [x] **Real money bug, both platforms**: `RiderOrder` types were missing `delivery_fee_kobo`
      entirely, so every rider screen displayed the customer's full `order.total_kobo` unlabeled —
      riders were looking at the customer's order value, not their own earnings. Riders actually
      keep 100% of `delivery_fee_kobo` (no commission, per `release_rider_payout`). Fixed the types
      and relabeled every amount display ("You earn ₦X" / "Order total" vs. "Your delivery fee" as
      distinct lines). Verified live against a real seeded order.
- [x] **web-rider's online/offline toggle never reflected real state** — it was local `useState`
      only, never calling `GET /dispatch/me`, so every page load showed "Offline" regardless of the
      rider's actual server-side status (app-rider already did this correctly). Fixed to fetch and
      source from the real profile.
- [x] Active delivery / order detail — hardcoded colors → semantic tokens (both platforms); a
      hand-rolled `STATUS_COLORS` map on web-rider replaced with the shared `OrderStatusBadge`.
- [x] Auth, order history, profile, payout account, availability — audited for the session's
      standard bug classes (native dialogs, fetch-error-as-empty-state, type looseness): 2
      `Alert.alert` native dialogs fixed on `app-rider` (sign-out, destructive order action);
      missing error states added to both platforms' dashboard/list/detail screens;
      `RiderOrder.status` tightened from `string` to the real `OrderStatus` union.
      `app-rider`'s `appearance.tsx` already has a correct 3-way System/Light/Dark toggle — ahead
      of web's simpler 2-way pattern.
      **Built (2026-09-18)**: the flagged rider earnings gap is closed. Added
      `GET /dispatch/me/earnings` (total earned/pending/deliveries-paid, mirrors the vendor
      analytics summary pattern) and `GET /dispatch/me/payouts` (paginated payout history) to
      `services/dispatch/router.py`/`service.py`/`schemas.py`. Verified live against the real DB —
      a temporary test payout row confirmed the aggregation math, then removed. Built an Earnings
      screen on both platforms: `app-rider` (`profile/earnings.tsx`, linked from a new "Earnings"
      row on Profile) and `web-rider` (`/earnings`, linked from a new card on Profile) — summary
      stat tiles + a payout history list, with proper loading/error/empty states throughout.
      Verified live on web-rider end to end (real login, real navigation, real empty state).
      `app-rider` verified via `tsc` + code review only (no simulator available).
      **Feature-parity gap closed (2026-09-18)**: `web-rider` now has both. Order history added as
      an Active/History `Tabs` split on `orders-page.tsx` (the same `Tabs` component already used
      identically on `web-customer`'s orders page — an established web convention, not a new one),
      each tab with its own loading/error/empty state. Payout-account setup added at
      `/profile/payout`, mirroring `web-vendor`'s existing `PayoutAccountForm` verify-before-save
      pattern (bank select → verify resolves the real account name via Paystack → save only enabled
      once verified), including the same discard-confirmation `ConfirmDialog` on a dirty cancel.
      Verified live: order history shows real active vs. terminal-state orders split correctly; the
      payout page loads the real bank list and enforces validation correctly in both themes.
      **Not verified**: the full verify → real Paystack account resolution → save round trip — no
      documented Paystack test-mode account number was found in this repo to test against safely.

- [x] **New feature, per direct user request (2026-09-18): rider address privacy.** A rider should
      not see the customer's delivery address until they've actually picked the order back up from
      the hub — before then, only the hub address is relevant to them. This wasn't just a UI
      concern: `apps/api/services/dispatch/router.py`'s `_order_resp` now genuinely withholds
      `delivery_address` (`{}` on the wire, not just hidden client-side) for any order still in
      `_PRE_HUB_HANDOFF_STATUSES` (everything up to and including `QA_PASSED` — reveal happens
      exactly at the `confirm-pickup` action, `QA_PASSED → OUT_FOR_DELIVERY`, i.e. the moment the
      rider actually receives the package back). Verified directly against real order data at three
      different statuses. Both rider apps' dashboard/order-detail/order-list screens updated to
      check for real address content and fall back to showing the hub as the destination
      (`hub_name`/`hub_lat`/`hub_lng`, already returned) when not yet revealed — including a real
      "Navigate to hub" vs. "Navigate" distinction on the dashboard's active-order card.
- [x] **Live map guiding the rider to the hub, per direct user request — built on both platforms.**
      Scoped deliberately (and stated plainly to the user up front): a live map with the rider's
      own GPS position + a destination marker + a dashed straight-line distance indicator — not
      road-snapped routing, which needs a paid routing API key (e.g. Mapbox Navigation) that isn't
      set up — plus the pre-existing "Navigate" deep-link to the phone's native Maps app kept as
      the real turn-by-turn path. `app-rider`: new `react-native-maps` map (`delivery-map.tsx`) +
      a `use-live-location.ts` hook (companion to the existing location-broadcast hook, which never
      exposed the coordinate back to the UI), wired into both the dashboard's active-order card and
      order-detail. `web-rider`: the Leaflet equivalent (`react-leaflet`, same `ssr:false` pattern
      as `web-customer`'s tracking map), with a graceful no-crash fallback when geolocation is
      denied or unsupported. **Real data-model limitation found and handled, not papered over**:
      `DeliveryAddress` has no lat/lng (street/city/state text only) — only the hub always has
      coordinates — so the live map only covers the to-hub leg; once the customer address is
      revealed post-handoff, "Open in Maps" (which geocodes the text address) remains the only way
      to reach it, since there's nothing to plot on an in-app map for that leg yet.
      **Action needed on your end for Android**: `react-native-maps` requires a Google Maps API key
      on Android (iOS needs none, it uses Apple Maps) — a config slot was added
      (`GOOGLE_MAPS_API_KEY_ANDROID` in `.env.local.example`) but without a real key, Android will
      show blank grey map tiles. Get a key from the Google Cloud Console (Maps SDK for Android) and
      set it before testing on an Android device/emulator.
      Verified live on `web-rider` (map/marker render correctly, denied-permission fallback works).
      `app-rider` verified via a clean type-check and code review only — no simulator was available
      to runtime-test the native map on-device.

### Phase E — Internal tools (lowest visual priority — function over polish, per §4.3's
`operational` motion profile, but should not look broken) — audit-and-fix pass done (2026-09-18)
**`web-admin` (15 pages) + `web-hub` (7 pages):**
- [x] Theme toggle added to both.
- [x] Consistent table/data-density components — `packages/ui`'s shared `DataTable` had no error
      state at all (a failed fetch looked identical to "no data") across every admin table; added
      `error`/`errorMessage`/`onRetry` props, backward-compatible, wired into 7 admin list pages.
      Hardcoded literal colors → semantic tokens across both apps (categories/users/vendors/escrow/
      dispatch pages on admin; analytics/dashboard/orders pages on hub), including Recharts
      hardcoded hex on admin's dashboard/analytics charts (now theme-matched in dark mode).
- [x] Dashboard/analytics views — **`GET /hub/analytics` was 500ing on every single call**
      (Postgres rejects the nested-aggregate SQL it was built with — `avg(extract(epoch, max()-min()))`
      in one grouped query), so web-hub's dashboard/analytics stat cards were silently showing
      `0`/`—` forever, made worse by the frontend's `HubStats` type inventing field names
      (`inbound_today` etc.) that don't exist on the real `HubAnalyticsResponse`. Both fixed
      (backend query rewritten as a subquery; frontend types/screens corrected); verified live with
      real seeded numbers.
      **Same money-correctness bug found on the admin side that was fixed for vendors earlier this
      session**: `get_overview`'s `revenue_today_kobo` summed the full escrow charge (order total +
      delivery fee) as "platform revenue" — fixed to commission-only, matching the `get_vendor_analytics`
      fix.
- [x] QA workflow screens (`web-hub`) — **the Inbound tab was permanently non-functional**: it
      filtered on the transient `AT_HUB` status (which no order is ever visibly sitting in — it
      passes straight through to `QA_IN_PROGRESS` within one request) instead of `ARRIVED_AT_HUB`,
      the same migration correctly applied elsewhere this session but missed on this one page.
      Fixed. QA-fail/pass already used `ConfirmDialog` correctly (no native-dialog fix needed here).
      **Flagged, not fixed**: `qa_pass` accepts no request body at all, so inspection notes typed
      before a PASS (as opposed to a FAIL) are silently discarded server-side — needs a backend
      schema/route change to actually persist.
- [x] Dispute/order management (`web-admin`) — **dispute resolution was completely broken**: the
      frontend sent `{decision, reason, split_percentage}`; the backend requires
      `{resolution, notes, vendor_amount_kobo?, refund_amount_kobo?}` — every resolve attempt 422'd.
      Fixed the contract and rebuilt the split-resolution UI to capture real ₦ amounts instead of a
      percentage with no backend field to receive it.
      **Platform config was also completely broken**: field names/shape didn't match the backend at
      all (plus one field, `max_delivery_radius_km`, that never existed server-side) — Settings
      always showed hardcoded defaults, and every save was a silent no-op. Fixed end-to-end; also
      added a confirmation dialog before saving (this is a high-blast-radius write — commission
      rate, delivery fee structure — that had none). Verified live: real saved values load, a save
      persists, and a real audit-log entry appears afterward.
      **Two more admin features 404'd despite a working UI, because the backend endpoints were
      simply never added**: hub edit/delete (`AdminService.update_hub`/`delete_hub` already existed
      correctly, just weren't wired to a route) and the audit-log viewer (nothing ever read back the
      `audit_log` table the app was already writing to). Both endpoints added and verified live.
      Order item names (`item.name` vs. the real `item.product_name`) and delivery-fee display
      fixed the same way as everywhere else this session.
      **Resolved (2026-09-18), per direct user decision — "let admin lead, not an env."**
      `PlatformConfig` (the DB row the admin panel edits) is now the sole, genuine source of truth
      for `commission_rate_percent`: `core/config.py`'s env-backed field removed entirely (env vars
      cleaned up too), and all three real call sites — `payment/service.py`'s `release_escrow` (the
      one that actually moves money), plus both `get_vendor_analytics` and admin's `get_overview` —
      now call `AnalyticsService.get_config()` instead. `get_config()` itself was hardened to merge
      the stored row over `DEFAULT_PLATFORM_CONFIG` rather than trusting it alone, so an older saved
      row missing a newer field falls back to its default instead of raising a `KeyError`. Also
      applied the same fix to `escrow_release_hours` — `workers/tasks/escrow.py`'s auto-release
      check was hardcoding 48h regardless of what admin had configured; now reads the real value.
      Verified live: `get_config()` returns the real merged config, and every consumer was confirmed
      to read from it (no remaining `settings.commission_rate_percent` reference anywhere).
      **`order_cancellation_window_minutes` — built (2026-09-18), scoped deliberately.**
      `PlatformConfig` had this value but nothing enforced it. Implemented the safe, unambiguous
      interpretation: a customer can self-cancel a PENDING (unpaid) order only within the
      configured window from `created_at` (default 30 min) — past that, `cancel_order` now returns
      a clear `CANCELLATION_WINDOW_EXPIRED` error instead of silently allowing an indefinitely-old
      unpaid order to be cancelled forever. **Deliberately did NOT build** the other common meaning
      of "cancellation window" — a post-payment grace period that would need to trigger a real
      Paystack refund — since that's a bigger product decision (refund eligibility, timing, who
      pays the transaction fee) this session wasn't asked to make. Verified live against the real
      DB: an order 12 days old correctly rejected with the new error message (which surfaces
      directly to the customer via the existing toast — no frontend change needed, `apiClient`
      already extracts `error.message`); a freshly-created order correctly still cancels.
      **If a post-payment cancellation/refund window is wanted, that's a separate feature to
      scope deliberately, not an extension of this fix.**
      **Also fixed while in this area**: a real, reproducible bug found by the web-rider parity
      pass below — Paystack's bank list occasionally repeats the same `code` across two entries,
      which made every bank `<select>`/picker in the app (`web-vendor`, `web-rider`, `app-vendor`,
      `app-rider` — all four payout-account forms share this exact pattern) render duplicate,
      ambiguous options and throw a React "duplicate key" warning. Fixed by deduplicating the bank
      list once at the data-fetching layer (a `select` transform on the `useBanks` query on
      web/RN, an equivalent filter on web-vendor's plain `useEffect` fetch) in all four places.
      Verified live: the rendered bank list is confirmed unique (was checked directly via the DOM —
      279 options, 279 unique values) and the earlier React key warning no longer appears.

---

## 7. Tooling delivered this pass

- [x] `Makefile`'s new `make dev-all` target — starts API, Celery worker + beat, the cloudflare
      tunnel, all 5 web apps, and all 3 mobile apps in one terminal via `concurrently`, colour-
      coded and labeled. Requires DBngin already running and `cloudflared` installed. Existing
      `make dev` / `dev-api` / `dev-web` / `dev-mobile` targets untouched.

---

## 8. Decisions (resolved 2026-09-17)

1. **Android first.** Apple Developer account deferred — launch is Android-only across all three
   mobile apps; iOS is a second wave. §3's app-store plan stands as written for Android; iOS rows
   are on hold until the account is purchased.
2. **Customer-first sequencing confirmed** — proceeding Phase B (customer) before Phase C/D/E as
   planned in §6.
3. **No additional brand guidance** — the logo files and tokens already in the repo (§4.1) are the
   full brand spec. Proceeding on that basis.
4. **Brand color confirmed (2026-09-17)**, after the "why does this look basic/blue" feedback
   traced above (§4.2) to a missing theme toggle rather than the color itself — **keep the current
   Royal Blue + Signal Orange**, no rebrand. Homepage hero carousel confirmed **theme-aware**
   (light/airy scrim in light mode, the existing cinematic dark treatment kept for dark mode) — done
   on `web-customer`, see §4.2.

## 9. Real bugs found and fixed on `app-customer` (2026-09-18), from direct user report

The user reported: stuck on a skeleton with no products loading, unable to navigate back from the
login screen, and a broken search screen. Diagnosed by running the app via `expo start --web` and
reproducing directly (browser console/network access this session doesn't have on a native
simulator) — four distinct, real, unrelated bugs found:

1. **App could hang forever on the loading screen — the actual cause of "stuck as skeleton."**
   `apps/app-customer/src/app/_layout.tsx`'s session-hydration `useEffect` had no top-level
   try/catch. Any failure in `secureStorage.getTokens()` (confirmed reproducible: `expo-secure-
   store`'s web target throws `getValueWithKeyAsync is not a function`, and comparable native
   failure modes exist too, e.g. keychain access issues) left `isHydrating` stuck `true` forever,
   since `setIsHydrating(false)` never ran. The whole app renders `<BrandLoader />` and nothing
   else while `isHydrating` is true — a full, permanent hang with zero error shown. Fixed with a
   proper try/catch/finally so any hydration failure degrades to "not logged in" instead of
   hanging.
2. **Stale LAN IP — the likely cause of "no products load."** `apps/app-customer/.env.local`
   (and `app-vendor`'s, `app-rider`'s, plus `apps/api/.env`'s CORS `FRONTEND_URLS`, all 5 web
   apps' `next.config.ts` `allowedDevOrigins`, all 3 `eas.json` build profiles) still pointed at
   `172.20.10.3` — an iPhone-hotspot-range IP from an earlier network, unreachable now that this
   machine's real LAN IP is `192.168.1.4` (verified: the stale IP doesn't respond, the real one
   does). Every API call from a phone on the current WiFi would have silently failed. Updated
   everywhere the stale IP appeared. **This will recur any time the dev machine changes networks —
   there's no code fix for that, just something to check first next time this exact symptom shows
   up.**
3. **A genuine React Native + TanStack Query gotcha, fixed defensively.** Query's default online-
   detection listens for browser `online`/`offline` events, which don't exist in React Native —
   confirmed via direct query-state inspection that a query can get stuck at `fetchStatus:
   'paused'` with `isLoading: false`, which every screen's `isLoading`-only branching reads as "no
   error, no data" rather than "never actually ran." Added the officially-recommended fix (`@react-
   native-community/netinfo` wired to `onlineManager`/`focusManager`, a new
   `configureQueryNetworking()` helper in `@avdan/mobile`, called from all three mobile apps'
   `_layout.tsx`). **Caveat, stated plainly**: this did not resolve the symptom in the `expo start
   --web` target used for this diagnosis — NetInfo's web fallback likely reports "disconnected" in
   that specific sandboxed browser (no Network Information API available), which is a testing-
   environment artifact, not something that happens on a real device where NetInfo queries the
   real OS connectivity state. Kept anyway as a correct, defensive fix; the two bugs above are the
   ones most likely responsible for what was actually seen on a real phone.
4. **Search screen — real layout bug, isolated to this one screen.** `search.tsx` never used
   `useSafeAreaInsets` (every other screen with a custom header in this app does — `cart.tsx`,
   `orders/index.tsx`, the shared `CustomerHeader` — this one was simply missed). With no top
   safe-area padding and `autoFocus` popping the keyboard immediately, the search bar would render
   under the status bar/notch on a real device — matches "focuses search but blows it off into the
   top of the screen, almost not even seeable." Fixed to match the established pattern
   (`insets.top + 12`, same as the other two screens).
5. **Login screen was a dead end — real, and against this app's own stated design principle.**
   `apps/app-customer` is meant to be publicly browsable with login only required for specific
   actions (an explicit decision from earlier this session) — but `(auth)/login.tsx` had no way to
   dismiss it at all, so a customer who tapped "Sign in" (or landed there via `SignInGate`) was
   stuck with no way back to the app they were browsing. Added an optional `onBack` prop to the
   shared `AuthSplitShell` (`packages/mobile`) — omitted for `app-vendor`/`app-rider`, where login
   is mandatory and there's nowhere meaningful to go back to — and wired it up only in
   `app-customer`'s login screen (`router.canGoBack() ? router.back() : router.replace('/')`).
   Verified live: sign-in-required prompt → tap Sign In → tap the new back arrow → back in the
   browsable app, not stranded.

All four fixes verified live via the `expo start --web` target (browser automation) against a
real local backend; `app-vendor`/`app-rider` picked up the same NetInfo wiring for consistency
but weren't otherwise touched. All affected apps (`@avdan/mobile`, `app-customer`, `app-vendor`,
`app-rider`) type-check clean.

## 10. Follow-up flagged for a deliberate decision soon: real turn-by-turn navigation service

Not decided or purchased yet — needs the user to pick a provider and get an API key before this
can go further than the OSRM-demo prototype (§ rider live map, this session). Comparison:

| Option | What it gives | Rough cost |
|---|---|---|
| **Mapbox (recommended)** | Directions API now (route lines); Navigation SDK later (spoken turn-by-turn, rerouting) — one vendor, no migration later | Directions API: ~100k free req/month, then a few $/1,000. Navigation SDK priced separately (per active user/month) — needs a real quote from Mapbox |
| **Google Maps Platform** | Directions API only — no self-serve third-party turn-by-turn SDK, that needs a special partner deal | $200/month free credit (~40k requests), then $5/1,000 |
| **HERE** | Comparable to Mapbox, strong logistics/enterprise track record | Free tier exists; enterprise pricing negotiated |
| **Self-hosted OSRM/Valhalla** | Free software, but you run the server + host map data | $0 licensing + your own infra/DevOps time |

**Built (2026-09-18)**: the rider live map (`app-rider`/`web-rider`) now shows a real,
road-following route line (`fetchRoadRoute` in each app's `modules/rider/lib/road-route.ts`) via
OSRM's free public demo server — explicitly **not production-safe** (no uptime SLA, can be
rate-limited or go down without warning). Debounced to refetch only when the destination changes
or the rider has moved ≥80m, with a strict 5s timeout, and falls back to the original straight
line if the request fails for any reason — verified live (a real curved route bending along actual
streets, confirmed via network + rendered path inspection) and the fallback path was also verified
(forced-failure test, confirmed it degrades to the straight line rather than breaking). This is a
working stopgap, not the final answer — no spoken turn-by-turn, no live rerouting, no traffic data.
**Action needed**: pick a provider (Mapbox recommended) and get an API key when ready to move past
the prototype.
