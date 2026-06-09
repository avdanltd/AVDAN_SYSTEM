import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { AdminOrder } from '../types'

export const ordersService = {
  getOrders: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AdminOrder>>('/admin/orders', params),

  getOrder: (id: string) => apiClient.get<AdminOrder>(`/admin/orders/${id}`),

  overrideStatus: (id: string, status: string, reason: string) =>
    apiClient.patch<AdminOrder>(`/admin/orders/${id}/status`, { status, reason }),
}
