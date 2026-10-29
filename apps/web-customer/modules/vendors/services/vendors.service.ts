import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { Vendor, VendorWithProducts } from '../types'

export const vendorsService = {
  getVendors: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Vendor>>('/vendors', params),
  getVendor: (slug: string) =>
    apiClient.get<VendorWithProducts>(`/vendors/${slug}`),
}
