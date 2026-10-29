// Edge runtime Sentry init. proxy.ts in this app runs on the Node.js runtime, not Edge (see
// CLAUDE.md), so this path is not currently exercised — kept for parity with the standard
// Next.js + Sentry instrumentation pattern in case an Edge route is added later. Fully inert
// until SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}
