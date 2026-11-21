import { apiClient } from '@/lib/api-client'
import type { BusinessSuggestion, MyBusinessStatus } from '@avdan/types'

export interface JoinRequestPayload {
  business_id?: string
  vendor_id?: string
  brand_name?: string
  note?: string
}

export const branchesService = {
  get: () => apiClient.get<MyBusinessStatus>('/vendors/me/business'),
  suggest: (q: string) => apiClient.get<BusinessSuggestion[]>('/vendors/me/business/suggest', { q }),
  request: (payload: JoinRequestPayload) => apiClient.post<MyBusinessStatus>('/vendors/me/business/request', payload),
  cancel: () => apiClient.delete<MyBusinessStatus>('/vendors/me/business/request'),
  leave: () => apiClient.post<MyBusinessStatus>('/vendors/me/business/leave', {}),
}
