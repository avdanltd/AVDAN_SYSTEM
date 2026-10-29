import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { AdminProduct } from '../types'

export interface ApproveBody {
  price_kobo: number
  discount_type?: 'FIXED' | 'PERCENT'
  discount_value?: number
}

export const productsService = {
  getProducts: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AdminProduct>>('/admin/products', params),

  approve: (id: string, body: ApproveBody) =>
    apiClient.post<AdminProduct>(`/admin/products/${id}/approve`, body),

  reject: (id: string, reason: string) =>
    apiClient.post<AdminProduct>(`/admin/products/${id}/reject`, { reason }),
}
