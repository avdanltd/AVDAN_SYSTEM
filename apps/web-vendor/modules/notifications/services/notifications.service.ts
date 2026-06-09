import { apiClient } from '@/lib/api-client'

export interface Notification {
  id: string
  type: string
  content: string
  read_at: string | null
  created_at: string
}

export interface NotificationsResponse {
  notifications: Notification[]
  unread_count: number
}

export const notificationsService = {
  getNotifications: (params?: Record<string, string>) =>
    apiClient.get<NotificationsResponse>('/notifications', params),

  markRead: (id: string) =>
    apiClient.post<{ message: string }>(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post<{ message: string }>('/notifications/read-all'),
}
