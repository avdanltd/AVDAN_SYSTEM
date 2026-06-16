import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { HubOrder, HubStats } from '../types'

export const hubService = {
  getStats: () => apiClient.get<HubStats>('/hub/analytics'),

  getInboundOrders: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<HubOrder>>('/hub/orders/inbound', params),

  getOrder: (id: string) => apiClient.get<HubOrder>(`/hub/orders/${id}`),

  receiveOrder: (orderId: string) =>
    apiClient.post<{ message: string }>(`/hub/orders/${orderId}/receive`),

  qaPass: (orderId: string, notes: string) =>
    apiClient.post<{ message: string }>(`/hub/orders/${orderId}/qa/pass`, { notes }),

  qaFail: (orderId: string, notes: string, evidence_urls: string[]) =>
    apiClient.post<{ message: string }>(`/hub/orders/${orderId}/qa/fail`, { notes, evidence_urls }),

  uploadEvidence: (orderId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.postMultipart<{ url: string }>(`/hub/orders/${orderId}/qa/evidence`, formData)
  },
}
