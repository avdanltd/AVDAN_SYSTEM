import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'

// Matches the actual backend response (services/notification/schemas.py's
// NotificationResponse) — not title/body/read at the top level, those live inside `content`,
// and "read" is derived from `read_at` being non-null.
export interface Notification {
  id: string
  type: string
  channel: string
  content: {
    title: string
    body: string
    [key: string]: unknown
  }
  read_at: string | null
  created_at: string
}

export const notificationsService = {
  getNotifications: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Notification>>('/notifications', params),
  // Backend route is POST /notifications/{id}/read, not PATCH.
  markRead: (id: string) =>
    apiClient.post<Notification>(`/notifications/${id}/read`),
  markAllRead: () =>
    apiClient.post<{ marked_read: number }>('/notifications/read-all'),
}
