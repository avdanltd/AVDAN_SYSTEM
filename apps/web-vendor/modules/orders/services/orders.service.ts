import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { VendorOrder } from '../types'

export const ordersService = {
  getOrders: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<VendorOrder>>('/orders/vendor/incoming', params),

  getOrder: (id: string) => apiClient.get<VendorOrder>(`/orders/vendor/${id}`),

  acceptOrder: (id: string) =>
    apiClient.post<{ message: string }>(`/orders/vendor/${id}/accept`),

  rejectOrder: (id: string, reason: string) =>
    apiClient.post<{ message: string }>(`/orders/vendor/${id}/reject`, { reason }),

  markReady: (id: string) =>
    apiClient.post<{ message: string }>(`/orders/vendor/${id}/ready`),
}
