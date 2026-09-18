import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { HubOrder, HubStats } from '../types'

export const hubService = {
  getStats: () => apiClient.get<HubStats>('/hub/analytics'),

  getInboundOrders: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<HubOrder>>('/hub/orders/inbound', params),

  getOrder: (id: string) => apiClient.get<HubOrder>(`/hub/orders/${id}`),

  // These three all return the updated OrderResponse (see `apps/api/services/qa/router.py`), not
  // a `{ message }` envelope — typed as HubOrder so callers can actually use the fresh order.
  receiveOrder: (orderId: string) => apiClient.post<HubOrder>(`/hub/orders/${orderId}/receive`),

  // NOTE: the backend's `qa_pass` endpoint takes no request body at all (see qa/router.py) — the
  // `notes` a hub agent types before pressing PASS are only persisted on a FAIL. Kept as a no-op
  // param here rather than silently dropping the caller's argument, but this is a real backend
  // gap: PASS notes are never saved.
  qaPass: (orderId: string, _notes: string) =>
    apiClient.post<HubOrder>(`/hub/orders/${orderId}/qa/pass`),

  qaFail: (orderId: string, notes: string, evidence_urls: string[]) =>
    apiClient.post<HubOrder>(`/hub/orders/${orderId}/qa/fail`, { notes, evidence_urls }),

  uploadEvidence: (orderId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.postMultipart<{ url: string }>(`/hub/orders/${orderId}/qa/evidence`, formData)
  },
}
