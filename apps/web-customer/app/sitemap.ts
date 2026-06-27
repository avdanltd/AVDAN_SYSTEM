import type { MetadataRoute } from 'next'
import { vendorsService } from '@/modules/vendors/services/vendors.service'
import { categoriesService } from '@/modules/categories/services/categories.service'
import { productsService } from '@/modules/products/services/products.service'

const BASE_URL = 'https://avdanstore.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/vendors`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ]

  try {
    const [vendorsRes, categoriesRes, productsRes] = await Promise.all([
      vendorsService.getVendors({ per_page: '500' }).catch(() => ({ items: [] })),
      categoriesService.getCategories().catch(() => []),
      productsService.getProducts({ limit: 500 }).catch(() => ({ items: [] })),
    ])

    const vendorRoutes: MetadataRoute.Sitemap = vendorsRes.items.map((v) => ({
      url: `${BASE_URL}/vendors/${v.slug}`,
      lastModified: new Date(v.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    const categoryRoutes: MetadataRoute.Sitemap = (Array.isArray(categoriesRes) ? categoriesRes : []).map((c) => ({
      url: `${BASE_URL}/categories/${c.slug}`,
      lastModified: new Date(c.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    const productRoutes: MetadataRoute.Sitemap = productsRes.items.map((p) => ({
      url: `${BASE_URL}/products/${p.id}`,
      lastModified: new Date(p.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

    return [...staticRoutes, ...vendorRoutes, ...categoryRoutes, ...productRoutes]
  } catch {
    return staticRoutes
  }
}
