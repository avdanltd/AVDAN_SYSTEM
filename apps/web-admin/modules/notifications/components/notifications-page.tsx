'use client'

import { useRouter } from 'next/navigation'
import { Bell, UserPlus } from 'lucide-react'

import { Button, EmptyState, Skeleton, cn, toast } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useMarkAllRead, useMarkRead, useNotifications } from '../hooks/use-notifications'

function formatWhen(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
}

export function NotificationsPage() {
  const router = useRouter()
  const { data, isLoading, error } = useNotifications({ page: '1', page_size: '50' })
  const { mutate: markRead } = useMarkRead()
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllRead()

  const items = data?.items ?? []
  const unread = data?.unread_count ?? 0

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : 'You are all caught up'}
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={markingAll}
            onClick={() =>
              markAllRead(undefined, {
                onSuccess: () => toast.success('All notifications marked as read'),
                onError: () => toast.error('Could not mark notifications as read'),
              })
            }
          >
            {markingAll ? 'Marking…' : 'Mark all read'}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="Could not load notifications"
          description={error.message}
          action={{ label: 'Retry', onClick: () => window.location.reload() }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="No notifications yet"
          description="You'll be told here whenever a new user joins."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const isNewUser = n.type === 'new_user'
            return (
              <button
                key={n.id}
                className={cn(
                  'flex w-full gap-3 rounded-xl border p-4 text-left transition-colors',
                  n.read_at
                    ? 'border-border bg-background hover:bg-secondary/50'
                    : 'border-primary/20 bg-primary/5 hover:bg-primary/10',
                )}
                onClick={() => {
                  if (!n.read_at) markRead(n.id)
                  if (isNewUser) router.push(ROUTES.users)
                  else if (n.type === 'vendor_message' && typeof n.content.vendor_id === 'string') {
                    router.push(ROUTES.vendor(n.content.vendor_id))
                  }
                }}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    n.read_at ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                  )}
                >
                  {isNewUser ? <UserPlus className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm', n.read_at ? 'text-foreground' : 'font-semibold text-foreground')}>
                      {n.content.title}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(n.created_at)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.content.body}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
