'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'

import { Button, EmptyState, PageLoader, cn, toast } from '@avdan/ui'
import { useNotifications } from '../hooks/use-notifications'
import { notificationsService } from '../services/notifications.service'
import type { Notification } from '../services/notifications.service'
import { formatRelativeTime } from '@/lib/format'

function NotificationItem({ notification }: { notification: Notification }) {
  const queryClient = useQueryClient()
  const isUnread = notification.read_at === null

  const { mutate: markRead, isPending } = useMutation({
    mutationFn: () => notificationsService.markRead(notification.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return (
    <div
      className={cn(
        'flex items-start gap-4 border-b border-border px-4 py-4 last:border-0 transition-colors',
        isUnread ? 'bg-primary/5' : 'bg-background',
      )}
    >
      <div
        className={cn(
          'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUnread ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
        )}
      >
        <Bell className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', isUnread ? 'font-medium text-foreground' : 'text-foreground')}>
          {notification.content}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>

      {isUnread && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs"
          onClick={() => markRead()}
          disabled={isPending}
        >
          Mark read
        </Button>
      )}
    </div>
  )
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useNotifications()
  const notifications = data?.notifications ?? []
  const unreadCount = data?.unread_count ?? 0

  const { mutate: markAllRead, isPending: markingAll } = useMutation({
    mutationFn: notificationsService.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to mark notifications as read')
    },
  })

  if (isLoading) return <PageLoader />

  if (error) {
    return (
      <EmptyState
        title="Failed to load notifications"
        description="There was a problem loading your notifications. Please refresh the page."
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead()}
            disabled={markingAll}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            {markingAll ? 'Marking…' : 'Mark all read'}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {notifications.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="You're all caught up. New notifications will appear here."
            className="py-12"
          />
        ) : (
          <div>
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
