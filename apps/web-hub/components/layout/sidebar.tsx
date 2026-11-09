'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Truck, BarChart2, User, Navigation } from 'lucide-react'

import { Avatar, AvatarFallback, Separator, cn, Logo } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useSession } from '@/modules/auth/hooks/use-session'
import { useAttention } from '@/modules/attention/hooks/use-attention'
import type { Attention } from '@/modules/attention/services/attention.service'

export const navItems: {
  label: string
  href: string
  icon: typeof LayoutDashboard
  attention?: keyof Attention
}[] = [
  { label: 'Dashboard', href: ROUTES.home, icon: LayoutDashboard },
  { label: 'Incoming', href: ROUTES.incoming, icon: Navigation },
  { label: 'Orders', href: ROUTES.orders, icon: Truck, attention: 'orders' as const },
  { label: 'Analytics', href: ROUTES.analytics, icon: BarChart2 },
  { label: 'Profile', href: ROUTES.profile, icon: User },
]

function getUserInitials(name: string | null | undefined): string {
  if (!name) return 'H'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname()
  const { user } = useSession()
  const { data: attention } = useAttention()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 flex-col justify-center gap-1 border-b border-border px-6">
        <Logo href="/" size="sm" />
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Agent Hub
        </span>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const waiting = item.attention ? (attention?.[item.attention] ?? 0) : 0
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNav}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {waiting > 0 && (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-none text-destructive-foreground"
                      title={`${waiting} waiting for action`}
                      aria-label={`${waiting} waiting for action`}
                    >
                      {waiting > 99 ? '99+' : waiting}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <Separator />
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">{getUserInitials(user?.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{user?.name ?? '—'}</p>
          <p className="truncate text-xs capitalize text-muted-foreground">{user?.role ?? ''}</p>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background lg:flex">
      <SidebarContent />
    </aside>
  )
}
