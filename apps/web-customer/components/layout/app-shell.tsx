import { Navbar } from './navbar'
import { Footer } from './footer'

interface AppShellProps {
  children: React.ReactNode
  fullWidth?: boolean
}

export function AppShell({ children, fullWidth }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {fullWidth ? (
          children
        ) : (
          <div className="mx-auto max-w-8xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        )}
      </main>
      <Footer />
    </div>
  )
}
