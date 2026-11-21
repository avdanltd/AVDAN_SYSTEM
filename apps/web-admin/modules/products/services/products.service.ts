import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { AdminProduct, ProductVendorSummary } from '../types'

export interface ApproveBody {
  price_kobo: number
  discount_type?: 'FIXED' | 'PERCENT'
  discount_value?: number
  special_delivery_fee_kobo?: number
}

export const productsService = {
  getVendors: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<ProductVendorSummary>>('/admin/products/vendors', params),

  getCounts: (vendorId?: string) =>
    apiClient.get<Record<string, number>>('/admin/products/counts', vendorId ? { vendor_id: vendorId } : undefined),

  getProducts: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AdminProduct>>('/admin/products', params),

  approve: (id: string, body: ApproveBody) =>
    apiClient.post<AdminProduct>(`/admin/products/${id}/approve`, body),

  setCategory: (id: string, categoryId: string | null) =>
    apiClient.patch<AdminProduct>(`/admin/products/${id}/category`, { category_id: categoryId }),

  reject: (id: string, reason: string) =>
    apiClient.post<AdminProduct>(`/admin/products/${id}/reject`, { reason }),
}
