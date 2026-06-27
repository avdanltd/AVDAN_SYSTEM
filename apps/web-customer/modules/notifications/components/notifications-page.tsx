'use client'

import { Button, EmptyState, Skeleton, cn, toast } from '@avdan/ui'
import { Bell, ShoppingBag, Package, Truck, CheckCircle2, AlertCircle } from 'lucide-react'
import { useNotifications, useMarkRead, useMarkAllRead } from '../hooks/use-notifications'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
}

function getNotificationIcon(type: string) {
  if (type.includes('order_placed') || type.includes('placed')) return <ShoppingBag className="h-4 w-4" />
  if (type.includes('deliver') || type.includes('completed')) return <CheckCircle2 className="h-4 w-4" />
  if (type.includes('pickup') || type.includes('transit') || type.includes('dispatch')) return <Truck className="h-4 w-4" />
  if (type.includes('accept') || type.includes('prepar')) return <Package className="h-4 w-4" />
  if (type.includes('reject') || type.includes('failed') || type.includes('cancel')) return <AlertCircle className="h-4 w-4" />
  return <Bell className="h-4 w-4" />
}

export function NotificationsPage() {
  const { data, isLoading, error } = useNotifications()
  const { mutate: markRead } = useMarkRead()
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead()

  const notifications = data?.items ?? []
  const unreadCount = notifications.filter((n) => !n.read).length

  function handleMarkAll() {
    markAllRead(undefined, {
      onSuccess: () => toast.success('All notifications marked as read'),
      onError: () => toast.error('Failed to mark notifications as read'),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={isMarkingAll}
          >
            {isMarkingAll ? 'Marking…' : 'Mark all read'}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-border p-4">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Could not load notifications"
          description={error.message}
          action={{ label: 'Retry', onClick: () => window.location.reload() }}
          icon={<Bell className="h-6 w-6" />}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="You'll be notified about your orders, deliveries, and more."
          icon={<Bell className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              className={cn(
                'w-full text-left flex gap-3 rounded-xl border p-4 transition-colors',
                notification.read
                  ? 'border-border bg-background hover:bg-secondary/50'
                  : 'border-primary/20 bg-primary/5 hover:bg-primary/10',
              )}
              onClick={() => {
                if (!notification.read) markRead(notification.id)
              }}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  notification.read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                )}
              >
                {getNotificationIcon(notification.type ?? '')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      'text-sm',
                      notification.read ? 'font-normal text-foreground' : 'font-semibold text-foreground',
                    )}
                  >
                    {notification.title}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                    <span className="text-xs text-muted-foreground">{formatDate(notification.created_at)}</span>
                  </div>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{notification.body}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
