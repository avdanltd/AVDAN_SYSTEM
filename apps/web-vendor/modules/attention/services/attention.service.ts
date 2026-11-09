import { apiClient } from '@/lib/api-client'

/** Items waiting on this vendor: paid orders to accept, and products the admin rejected. */
export interface Attention {
  orders: number
  products: number
}

export const attentionService = {
  get: () => apiClient.get<Attention>('/vendors/me/attention'),
}
