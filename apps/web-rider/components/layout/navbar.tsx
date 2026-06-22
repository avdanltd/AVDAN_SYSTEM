'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, User } from 'lucide-react'
import { cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'

const NAV_ITEMS = [
  { label: 'Home', href: ROUTES.home, icon: Home },
  { label: 'Orders', href: ROUTES.orders, icon: Package },
  { label: 'Profile', href: ROUTES.profile, icon: User },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-4 py-2 text-xs transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5px]')} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
