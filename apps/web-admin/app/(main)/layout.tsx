import { AppShell } from '@/components/layout/app-shell'
import { SessionProvider } from '@/components/common/session-provider'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <SessionProvider>{children}</SessionProvider>
    </AppShell>
  )
}
