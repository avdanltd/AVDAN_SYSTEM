import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsService } from '../services/notifications.service'

export function useNotifications(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationsService.getNotifications(params),
    staleTime: 10_000,
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
