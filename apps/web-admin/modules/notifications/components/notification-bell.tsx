'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'

import { Button, cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useUnreadCount } from '../hooks/use-notifications'

/** Top-bar bell: jingles and shows a red count while there are unread notifications
 * (new users joining, and anything else addressed to the admin). */
export function NotificationBell() {
  const { data } = useUnreadCount()
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
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
    </Link>
  )
}
