import type { MetadataRoute } from 'next'
import { vendorsService } from '@/modules/vendors/services/vendors.service'

const BASE_URL = 'https://avdanstore.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]

  try {
    const { items: vendors } = await vendorsService.getVendors({ per_page: '500' })
    const vendorRoutes: MetadataRoute.Sitemap = vendors.map((vendor) => ({
      url: `${BASE_URL}/vendors/${vendor.slug}`,
      lastModified: new Date(vendor.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
    return [...staticRoutes, ...vendorRoutes]
  } catch {
    // If backend is not reachable during build, return static routes only
    return staticRoutes
  }
}
