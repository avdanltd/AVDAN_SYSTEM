// Next.js instrumentation hook — runs once per server/edge runtime instance on boot.
// Loads the matching Sentry init file per runtime. Both are inert unless a DSN env var is
// set (see sentry.server.config.ts / sentry.edge.config.ts) — nothing here changes behavior
// when Sentry is unconfigured.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
