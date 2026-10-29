import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { AdminDispute, ResolveDisputePayload } from '../types'

export const disputesService = {
  getDisputes: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AdminDispute>>('/admin/disputes', params),

  getDispute: (id: string) => apiClient.get<AdminDispute>(`/admin/disputes/${id}`),

  resolve: (id: string, payload: ResolveDisputePayload) =>
    apiClient.post<AdminDispute>(`/admin/disputes/${id}/resolve`, payload),
}
