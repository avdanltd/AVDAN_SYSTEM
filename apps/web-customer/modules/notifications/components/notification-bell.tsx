'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Button, cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { notificationsService } from '../services/notifications.service'

/**
 * The bell in the top bar. With unread notifications it jingles and carries a red count badge
 * until they are read, so a customer notices an order update without opening anything.
 * Polled lightly; opening the notifications page marks things read and the count clears.
 */
export function NotificationBell() {
  const { data } = useQuery({
    // Shares the ['notifications'] prefix so marking read refreshes this immediately.
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsService.getNotifications({ page: '1', page_size: '1' }),
    refetchInterval: 30_000,
    staleTime: 10_000,
    select: (d) => d.unread_count ?? 0,
  })
  const unread = data ?? 0

  return (
    <Link href={ROUTES.notifications}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Bell className={cn('h-5 w-5', unread > 0 && 'avdan-animate-bell-ring text-primary')} />
        {unread > 0 && (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1',
              'bg-destructive text-[10px] font-bold leading-none text-destructive-foreground',
            )}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
    </Link>
  )
}
