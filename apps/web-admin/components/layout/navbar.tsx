'use client'

import { Avatar, AvatarFallback } from '@avdan/ui'

export function Navbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="lg:hidden">
        <span className="text-lg font-bold tracking-tight text-primary">AVDAN Admin</span>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
