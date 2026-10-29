import type { PaginatedResponse, PayoutRequest } from '@avdan/types'

import { apiClient } from '@/lib/api-client'

export type PayoutList = PaginatedResponse<PayoutRequest> & {
  pending_count: number
  pending_kobo: number
}

export const payoutsService = {
  list: (params: Record<string, string>) => apiClient.get<PayoutList>('/admin/payouts', params),
  get: (id: string) => apiClient.get<PayoutRequest>(`/admin/payouts/${id}`),
  approve: (id: string, approvedKobo: number, note: string | null) =>
    apiClient.post<PayoutRequest>(`/admin/payouts/${id}/approve`, {
      approved_kobo: approvedKobo,
      note,
    }),
  reject: (id: string, note: string) =>
    apiClient.post<PayoutRequest>(`/admin/payouts/${id}/reject`, { note }),
}
