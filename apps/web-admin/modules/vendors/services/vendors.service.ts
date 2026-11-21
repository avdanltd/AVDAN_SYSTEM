import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { AdminVendor, VendorMessage, VendorProfile } from '../types'

export const vendorsService = {
  getVendors: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AdminVendor>>('/admin/vendors', params),

  getProfile: (id: string) => apiClient.get<VendorProfile>(`/admin/vendors/${id}`),

  getMessages: (id: string) => apiClient.get<VendorMessage[]>(`/admin/vendors/${id}/messages`),

  sendMessage: (id: string, body: string) =>
    apiClient.post<VendorMessage>(`/admin/vendors/${id}/messages`, { body }),

  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.patch<AdminVendor>(`/admin/vendors/${id}/status`, { status, reason }),
}
