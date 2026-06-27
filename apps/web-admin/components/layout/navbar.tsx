'use client'

import { useState } from 'react'
import Link from 'next/link'

import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
  Logo,
} from '@avdan/ui'
import { useSession } from '@/modules/auth/hooks/use-session'
import { useLogout } from '@/modules/auth/hooks/use-logout'
import { SidebarContent } from './sidebar'
import { ROUTES } from '@/config/routes'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function getUserInitials(name: string | null | undefined): string {
  if (!name) return 'A'
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export function Navbar() {
  const { user } = useSession()
  const { mutate: logout, isPending } = useLogout()
  const [mobileOpen, setMobileOpen] = useState(false)
  const initials = getUserInitials(user?.name)

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <SidebarContent onNav={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Logo size="sm" suffix="Admin" />
      </div>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 rounded-full p-0" aria-label="User menu">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name ?? '—'}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">{user?.role ?? ''}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={ROUTES.profile}>Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              disabled={isPending}
              className="text-destructive focus:text-destructive"
            >
              {isPending ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
