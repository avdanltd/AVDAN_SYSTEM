import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { AdminVendor } from '../types'

export const vendorsService = {
  getVendors: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AdminVendor>>('/admin/vendors', params),

  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.patch<AdminVendor>(`/admin/vendors/${id}/status`, { status, reason }),
}
