import { apiClient } from '@/lib/api-client'

/** Items waiting on a person, per admin section. */
export interface Attention {
  products: number
  vendors: number
  payouts: number
  disputes: number
  dispatch: number
}

export const attentionService = {
  get: () => apiClient.get<Attention>('/admin/attention'),
}
