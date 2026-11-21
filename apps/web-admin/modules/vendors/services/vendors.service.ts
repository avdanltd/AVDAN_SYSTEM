import { apiClient } from '@/lib/api-client'
import type { BranchRequest, BusinessSummary, PaginatedResponse } from '@avdan/types'
import type { AdminVendor, VendorMessage, VendorProfile } from '../types'

export const vendorsService = {
  getVendors: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AdminVendor>>('/admin/vendors', params),

  getCounts: () => apiClient.get<Record<string, number>>('/admin/vendors/counts'),

  getProfile: (id: string) => apiClient.get<VendorProfile>(`/admin/vendors/${id}`),

  getMessages: (id: string) => apiClient.get<VendorMessage[]>(`/admin/vendors/${id}/messages`),

  sendMessage: (id: string, body: string) =>
    apiClient.post<VendorMessage>(`/admin/vendors/${id}/messages`, { body }),

  getBranchRequests: (status = 'pending') =>
    apiClient.get<BranchRequest[]>('/admin/branch-requests', { status }),

  approveBranchRequest: (id: string, businessName?: string) =>
    apiClient.post<BusinessSummary>(`/admin/branch-requests/${id}/approve`, { business_name: businessName || null }),

  rejectBranchRequest: (id: string, reason: string) =>
    apiClient.post<void>(`/admin/branch-requests/${id}/reject`, { reason }),

  getBusinesses: (search?: string) =>
    apiClient.get<BusinessSummary[]>('/admin/businesses', search ? { search } : undefined),

  setVendorBusiness: (vendorId: string, businessId: string | null, name?: string) =>
    apiClient.put<BusinessSummary>(`/admin/vendors/${vendorId}/business`, { business_id: businessId, name: name || null }),

  unlinkVendor: (vendorId: string) => apiClient.delete<void>(`/admin/vendors/${vendorId}/business`),

  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.patch<AdminVendor>(`/admin/vendors/${id}/status`, { status, reason }),
}
