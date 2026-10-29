import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { AdminProduct } from '../types'

export const productsService = {
  getProducts: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AdminProduct>>('/admin/products', params),

  approve: (id: string, priceKobo: number) =>
    apiClient.post<AdminProduct>(`/admin/products/${id}/approve`, { price_kobo: priceKobo }),

  reject: (id: string, reason: string) =>
    apiClient.post<AdminProduct>(`/admin/products/${id}/reject`, { reason }),
}
