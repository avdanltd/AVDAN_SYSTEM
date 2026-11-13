# Analytics + SEO plan (kick-off 2026-11-14)

Goal: know who visits avdanstore.com and what they do, and rank for the things shoppers search.
Status: **planned, nothing built yet.** Written 2026-11-13.

## Audit (2026-11-13, web-customer)
- **No analytics anywhere** (customer, vendor, admin, hub, rider).
- `app/robots.ts` and `app/sitemap.ts` exist. Sitemap calls the API with `per_page` / `limit` params:
  **verify it really lists products, vendors and categories** (fetches fail silently to the static list).
- Metadata is generic: root title "AVDAN"; product page title is the static "Product — AVDAN".
  No per-vendor / per-product titles, Open Graph/Twitter cards, canonical links, `metadataBase`, or JSON-LD.
- Root `app/layout.tsx` reads the `avdan_token` cookie and calls `/auth/me` on every request, which makes
  every page dynamic (no caching, slower TTFB). Consider moving session lookup out of the root layout.
- Product page (`products/[id]/page.tsx`) only passes `productId` to `ProductDetailPage`; **confirm whether
  content is fetched client-side** (crawlers would see an empty shell). If so, fetch on the server.

## Phase 1 — Analytics
- GA4 on web-customer behind a **cookie-consent banner** (NDPR / good practice). Load only after consent.
- Funnel events: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `search`, `location_filter`,
  `sign_up`, `newsletter_subscribe`. Keep payloads free of personal data (no names, emails, phones).
- Lighter page-view tracking on vendor / rider / hub web. **Do not track web-admin** (staff + money data).
- Google Search Console + Bing Webmaster Tools; submit the sitemap.
- Optional: Microsoft Clarity (free heatmaps / session replay). Mask inputs; never record checkout fields.
- Measurement ID goes in env (`NEXT_PUBLIC_GA_ID`), never hard-coded.

## Phase 2 — SEO foundations (needs nothing from the owner; start here)
1. `metadataBase` + `NEXT_PUBLIC_SITE_URL`; drop the hard-coded `https://avdanstore.com` strings.
2. `generateMetadata` for product / vendor / category / search with real titles, descriptions, OG + Twitter
   images. Default share image 1200x630.
3. Canonical links; filtered/sorted URLs (`?state=`, `?sort=`, `?page=`) canonicalise to the clean page.
4. JSON-LD: Organization, WebSite (+ SearchAction), Product (price NGN, availability, aggregateRating from
   reviews), LocalBusiness/Store for vendors, BreadcrumbList.
5. Fix + test the sitemap (include products, vendors, categories; correct `lastModified`; split if > 50k).
6. `noindex` on cart, checkout, orders, profile, notifications, auth pages; keep robots in sync.
7. Server-render page content (see audit); keep images optimised (`next/image`, width/height, alt text).

## Phase 3 — Usage and health
- Core Web Vitals reported to GA4 (`useReportWebVitals`).
- Uptime check on `avdanstore.com` and `api.avdanstore.com`; optional Sentry for front-end errors.
- Admin "business pulse" from our own DB (orders, signups, active vendors by day). Cookie-free and more
  accurate for sales than GA4.

## Phase 4 — Off-code (owner)
- Google Business Profile; consistent business name/address/phone across the web.
- Keyword + local-intent research ("buy <category> in <city>"); Semrush connector is available in Claude.
- Ask vendors for good product titles/descriptions/photos: it is the main on-page SEO lever for a marketplace.

## Needed from the owner before Phase 1
1. GA4 property for avdanstore.com + its **Measurement ID** (`G-XXXXXXXXXX`); say who owns the Google account.
2. Search Console property (domain verification via DNS or HTML tag).
3. Decisions: GA4 vs privacy-first alternative (e.g. Plausible, no banner); include Clarity?; Sentry?
4. Brand blurb, default share image (1200x630), preferred search-result tagline, target keywords/cities.

## Shipping
Usual flow: branch from `origin/develop` -> PR -> CI -> merge -> release PR to `main` -> watch the
"Production — CI → Build → Deploy" run. Set the GA ID in the prod web-customer env, then recreate the
container (a plain restart does not re-read `env_file`).

## Verification (when built)
Rich Results Test on a product and a vendor page; Search Console coverage; GA4 Realtime shows a test
visit and a test purchase; Lighthouse SEO + Performance on home, product, category.
