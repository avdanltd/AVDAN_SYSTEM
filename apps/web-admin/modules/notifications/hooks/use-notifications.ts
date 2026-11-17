import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsService } from '../services/notifications.service'

export function useNotifications(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationsService.getNotifications(params),
    staleTime: 10_000,
  })
}

/** Unread count for the top-bar bell. Polled lightly; marking read refreshes it at once. */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsService.getNotifications({ page: '1', page_size: '1' }),
    refetchInterval: 30_000,
    staleTime: 10_000,
    select: (d) => d.unread_count ?? 0,
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
