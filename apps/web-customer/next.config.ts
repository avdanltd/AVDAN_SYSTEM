import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@avdan/ui', '@avdan/types'],
  // See the matching comment in apps/web-vendor/next.config.ts — local multi-role E2E
  // testing accesses these apps via localhost / 127.0.0.1 / the LAN IP, and Next.js 16's
  // dev-only allowedDevOrigins guard otherwise blocks hydration on any origin but the
  // one the dev server was first opened from, silently breaking client-side forms (they
  // fall back to a native GET submit — credentials in the URL). Dev-only; no effect on
  // a production build. Update the LAN IP if it changes.
  allowedDevOrigins: ['127.0.0.1', '172.20.10.3'],
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

export default nextConfig
