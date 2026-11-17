import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'

// Matches the backend NotificationResponse: title/body live inside `content`, and "read" is
// derived from `read_at` being non-null.
export interface Notification {
  id: string
  type: string
  channel: string
  content: {
    title: string
    body: string
    user_id?: string
    role?: string
    [key: string]: unknown
  }
  read_at: string | null
  created_at: string
}

export const notificationsService = {
  getNotifications: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Notification> & { unread_count: number }>('/notifications', params),
  markRead: (id: string) => apiClient.post<Notification>(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post<{ marked_read: number }>('/notifications/read-all'),
}
