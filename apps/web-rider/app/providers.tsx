'use client'

import { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { getQueryClient } from '@/lib/query-client'
import { SessionProvider } from '@/components/common/session-provider'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        {children}
        <Toaster richColors position="top-center" />
      </SessionProvider>
    </QueryClientProvider>
  )
}
