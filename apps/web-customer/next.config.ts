import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@avdan/ui', '@avdan/types'],
  // See the matching comment in apps/web-vendor/next.config.ts — local multi-role E2E
  // testing accesses these apps via localhost / 127.0.0.1 / the LAN IP, and Next.js 16's
  // dev-only allowedDevOrigins guard otherwise blocks hydration on any origin but the
  // one the dev server was first opened from, silently breaking client-side forms (they
  // fall back to a native GET submit — credentials in the URL). Dev-only; no effect on
  // a production build. Update the LAN IP if it changes.
  allowedDevOrigins: ['127.0.0.1', '192.168.1.4'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
}

// Wraps the config with Sentry's build plugin. Source map upload is explicitly disabled —
// it needs a SENTRY_AUTH_TOKEN that doesn't exist yet — so this has zero effect on the build
// output until that's wired up later; error tracking itself is controlled separately by the
// SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN env vars (see instrumentation.ts and
// instrumentation-client.ts).
export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: {
    disable: true,
  },
})
