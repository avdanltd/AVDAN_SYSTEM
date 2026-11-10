'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Store,
  AlertTriangle,
  DollarSign,
  Banknote,
  Truck,
  BarChart2,
  Settings,
  Building2,
  Tag,
  Siren,
  PackageCheck,
  Wallet,
  Star,
} from 'lucide-react'

import { Avatar, AvatarFallback, Separator, cn, Logo, Button } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useSession } from '@/modules/auth/hooks/use-session'
import { useAttention } from '@/modules/attention/hooks/use-attention'
import type { Attention } from '@/modules/attention/services/attention.service'

export const navItems: { label: string; href: string; icon: typeof Users; attention?: keyof Attention }[] = [
  { label: 'Dashboard', href: ROUTES.home, icon: LayoutDashboard },
  { label: 'Users', href: ROUTES.users, icon: Users },
  { label: 'Orders', href: ROUTES.orders, icon: ShoppingBag },
  { label: 'Vendors', href: ROUTES.vendors, icon: Store, attention: 'vendors' },
  { label: 'Products', href: ROUTES.products, icon: PackageCheck, attention: 'products' },
  { label: 'Categories', href: ROUTES.categories, icon: Tag },
  { label: 'Reviews', href: ROUTES.reviews, icon: Star },
  { label: 'Disputes', href: ROUTES.disputes, icon: AlertTriangle, attention: 'disputes' },
  { label: 'Escrow', href: ROUTES.escrow, icon: DollarSign },
  { label: 'Payouts', href: ROUTES.payouts, icon: Banknote, attention: 'payouts' },
  { label: 'Financial Tracker', href: ROUTES.finance, icon: Wallet },
  { label: 'Dispatch', href: ROUTES.dispatch, icon: Truck, attention: 'dispatch' },
  { label: 'Hubs', href: ROUTES.hubs, icon: Building2 },
  { label: 'Analytics', href: ROUTES.analytics, icon: BarChart2 },
  { label: 'Config', href: ROUTES.config, icon: Settings },
]

function getUserInitials(name: string | null | undefined): string {
  if (!name) return 'A'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname()
  const { data: attention } = useAttention()
  const { user } = useSession()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 flex-col justify-center gap-1 border-b border-border px-6">
        <Logo href="/" size="sm" />
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Operations Hub
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
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
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

      <div className="px-3 pb-3">
        <Button
          asChild
          className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90"
        >
          <Link href={ROUTES.dispatch} onClick={onNav}>
            <Siren className="h-4 w-4 shrink-0" />
            Emergency Dispatch
          </Link>
        </Button>
      </div>

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
