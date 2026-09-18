import { ReactNode } from 'react'
import { Logo, ThemeToggle } from '@avdan/ui'
import { Navbar } from './navbar'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <Logo size="sm" suffix="Rider" />
        <ThemeToggle />
      </header>
      <main className="pb-20">{children}</main>
      <Navbar />
    </div>
  )
}
