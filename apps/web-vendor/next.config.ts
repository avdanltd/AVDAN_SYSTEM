import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@avdan/ui', '@avdan/types'],
  // Local multi-role E2E testing (see RUNBOOK_ORDER_E2E.md §1) deliberately opens each
  // role on a different hostname on the SAME machine — localhost / 127.0.0.1 / the LAN
  // IP — because auth cookies ignore port numbers, so this is the only way to hold
  // several role sessions in one browser. Next.js 16's dev-only allowedDevOrigins guard
  // treats those as different origins and silently blocks the client JS bundle/HMR from
  // loading, so the page never hydrates. Without hydration React's onSubmit never
  // attaches, and forms silently fall back to a native HTML GET submit — which puts
  // whatever was typed, including a password, into the URL (browser history, and this
  // dev server's own request log). Declaring the origins here is dev-only (next dev);
  // it does nothing in a production build. Update the LAN IP if it changes.
  allowedDevOrigins: ['127.0.0.1', '172.20.10.3'],
}

export default nextConfig
