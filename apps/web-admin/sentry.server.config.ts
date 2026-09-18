// Server-side (Node.js runtime) Sentry init. Fully inert until SENTRY_DSN is set — no Sentry
// account exists yet. Never throws or changes behavior when the DSN is absent.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}
