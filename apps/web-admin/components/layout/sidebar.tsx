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
  Truck,
  BarChart2,
  Settings,
  Building2,
  Tag,
} from 'lucide-react'

import { Avatar, AvatarFallback, Separator, cn, Logo } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useSession } from '@/modules/auth/hooks/use-session'

export const navItems = [
  { label: 'Dashboard', href: ROUTES.home, icon: LayoutDashboard },
  { label: 'Users', href: ROUTES.users, icon: Users },
  { label: 'Orders', href: ROUTES.orders, icon: ShoppingBag },
  { label: 'Vendors', href: ROUTES.vendors, icon: Store },
  { label: 'Categories', href: ROUTES.categories, icon: Tag },
  { label: 'Disputes', href: ROUTES.disputes, icon: AlertTriangle },
  { label: 'Escrow', href: ROUTES.escrow, icon: DollarSign },
  { label: 'Dispatch', href: ROUTES.dispatch, icon: Truck },
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
  const { user } = useSession()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Logo size="md" suffix="Admin" />
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
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
                  {item.label}
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
