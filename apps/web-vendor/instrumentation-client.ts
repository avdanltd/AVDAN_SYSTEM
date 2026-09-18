// Browser-side Sentry init. Fully inert until NEXT_PUBLIC_SENTRY_DSN is set — no Sentry
// account exists yet. Never throws or changes page-load behavior when the DSN is absent.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}

// Required export (even when Sentry is uninitialized, this is a harmless no-op) so the SDK
// can instrument App Router client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
