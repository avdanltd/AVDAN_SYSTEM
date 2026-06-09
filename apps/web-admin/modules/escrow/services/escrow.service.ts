import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { EscrowOrder } from '../types'

export const escrowService = {
  getPendingRelease: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<EscrowOrder>>('/admin/orders', {
      status: 'PAYMENT_RELEASE_PENDING',
      ...params,
    }),

  getHeld: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<EscrowOrder>>('/admin/orders', {
      status: 'DELIVERED',
      ...params,
    }),
}
