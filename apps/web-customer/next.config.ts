import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@avdan/ui', '@avdan/types'],
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
