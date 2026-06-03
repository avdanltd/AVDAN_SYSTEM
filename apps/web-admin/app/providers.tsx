'use client'

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@avdan/ui'

import { makeQueryClient } from '@/lib/query-client'
import type { User } from '@/modules/auth/services/auth.service'
import { SessionHydrate } from '@/modules/auth/components/session-hydrate'

interface ProvidersProps {
  children: React.ReactNode
  user: User | null
}

export function Providers({ children, user }: ProvidersProps) {
  const [queryClient] = useState(() => makeQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <SessionHydrate user={user} />
      {children}
      <ToastProvider />
    </QueryClientProvider>
  )
}
