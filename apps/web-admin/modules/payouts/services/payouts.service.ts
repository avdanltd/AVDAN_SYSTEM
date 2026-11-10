import type { PaginatedResponse, PayoutPinStatus, PayoutRequest } from '@avdan/types'

import { apiClient } from '@/lib/api-client'

export type PayoutList = PaginatedResponse<PayoutRequest> & {
  pending_count: number
  pending_kobo: number
}

export const payoutsService = {
  list: (params: Record<string, string>) => apiClient.get<PayoutList>('/admin/payouts', params),
  get: (id: string) => apiClient.get<PayoutRequest>(`/admin/payouts/${id}`),
  approve: (id: string, approvedKobo: number, note: string | null, pin: string) =>
    apiClient.post<PayoutRequest>(`/admin/payouts/${id}/approve`, {
      approved_kobo: approvedKobo,
      note,
      pin,
    }),
  refresh: (id: string) => apiClient.post<PayoutRequest>(`/admin/payouts/${id}/refresh`, {}),
  pinStatus: () => apiClient.get<PayoutPinStatus>('/admin/payouts/pin'),
  setPin: (pin: string, currentPassword: string) =>
    apiClient.put<PayoutPinStatus>('/admin/payouts/pin', { pin, current_password: currentPassword }),
  reject: (id: string, note: string) =>
    apiClient.post<PayoutRequest>(`/admin/payouts/${id}/reject`, { note }),
}
