'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'

const navItems = [
  { label: 'Dashboard', href: ROUTES.home },
  { label: 'Orders', href: ROUTES.orders },
  { label: 'Products', href: ROUTES.products },
  { label: 'Earnings', href: ROUTES.earnings },
  { label: 'Profile', href: ROUTES.profile },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background lg:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <span className="text-lg font-bold tracking-tight text-primary">AVDAN Vendor</span>
      </div>
      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary/90'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
