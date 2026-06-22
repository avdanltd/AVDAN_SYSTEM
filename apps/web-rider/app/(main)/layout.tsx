import { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { ErrorBoundary } from '@/components/common/error-boundary'

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AppShell>{children}</AppShell>
    </ErrorBoundary>
  )
}
