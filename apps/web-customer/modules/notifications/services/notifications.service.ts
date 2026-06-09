import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'

export interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  created_at: string
  type?: string
}

export const notificationsService = {
  getNotifications: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Notification>>('/notifications', params),
  markRead: (id: string) =>
    apiClient.patch<{ message: string }>(`/notifications/${id}/read`),
  markAllRead: () =>
    apiClient.post<{ message: string }>('/notifications/read-all'),
}
