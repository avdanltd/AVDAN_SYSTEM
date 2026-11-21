import { apiClient } from '@/lib/api-client'
import type { BusinessDetail, PaginatedResponse } from '@avdan/types'
import type { Vendor, VendorWithProducts } from '../types'

export const vendorsService = {
  // Brands with several branches are listed once by default; pass group: 'false' for every vendor.
  getVendors: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Vendor>>('/vendors', { group: 'true', ...params }),
  getBusiness: (slug: string, params?: Record<string, string>) =>
    apiClient.get<BusinessDetail>(`/vendors/business/${slug}`, params),
  getVendor: (slug: string) =>
    apiClient.get<VendorWithProducts>(`/vendors/${slug}`),
}
