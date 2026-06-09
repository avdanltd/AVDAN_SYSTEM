import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { AdminUser, CreateAdminPayload, Hub, CreateHubPayload } from '../types'

export const usersService = {
  getUsers: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AdminUser>>('/admin/users', params),

  updateStatus: (id: string, status: string) =>
    apiClient.patch<AdminUser>(`/admin/users/${id}/status`, { status }),

  createAdmin: (payload: CreateAdminPayload) =>
    apiClient.post<AdminUser>('/admin/users', payload),

  listHubs: () =>
    apiClient.get<Hub[]>('/admin/hubs'),

  createHub: (payload: CreateHubPayload) =>
    apiClient.post<Hub>('/admin/hubs', payload),

  assignHub: (userId: string, hubId: string | null) =>
    apiClient.patch<AdminUser>(`/admin/users/${userId}/hub`, { hub_id: hubId }),
}
