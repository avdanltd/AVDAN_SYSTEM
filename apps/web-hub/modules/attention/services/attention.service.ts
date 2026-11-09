import { apiClient } from '@/lib/api-client'

/** Parcels at this hub that need a person: arrived and not yet received, or mid-QA. */
export interface Attention {
  orders: number
}

export const attentionService = {
  get: () => apiClient.get<Attention>('/hub/attention'),
}
