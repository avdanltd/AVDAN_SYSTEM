import { ReactNode } from 'react'
import { Navbar } from './navbar'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">{children}</main>
      <Navbar />
    </div>
  )
}
