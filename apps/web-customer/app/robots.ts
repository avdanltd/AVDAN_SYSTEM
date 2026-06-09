import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/checkout', '/orders', '/profile', '/notifications'],
    },
    sitemap: 'https://avdanstore.com/sitemap.xml',
  }
}
