'use client'

import { Button, Avatar, AvatarFallback } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import Link from 'next/link'

export function Navbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="lg:hidden">
        <span className="text-lg font-bold tracking-tight text-primary">AVDAN Vendor</span>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        <Link href={ROUTES.notifications}>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <span className="text-lg">🔔</span>
          </Button>
        </Link>
        <Avatar>
          <AvatarFallback>V</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
