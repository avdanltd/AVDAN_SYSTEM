import { apiClient } from '@/lib/api-client'

// Matches the actual backend response (services/notification/schemas.py's
// NotificationResponse / PaginatedNotificationsResponse) — title/body live nested inside
// `content`, not at the top level, and the list comes back as `items`, not `notifications`.
export interface Notification {
  id: string
  type: string
  content: {
    title: string
    body: string
    [key: string]: unknown
  }
  read_at: string | null
  created_at: string
}

export interface NotificationsResponse {
  items: Notification[]
  total: number
  unread_count: number
  page: number
  page_size: number
}

export const notificationsService = {
  getNotifications: (params?: Record<string, string>) =>
    apiClient.get<NotificationsResponse>('/notifications', params),

  markRead: (id: string) =>
    apiClient.post<Notification>(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post<{ marked_read: number }>('/notifications/read-all'),
}
