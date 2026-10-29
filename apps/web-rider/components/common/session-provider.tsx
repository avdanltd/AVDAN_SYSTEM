'use client'

import { ReactNode } from 'react'
import { SessionHydrate } from '@/modules/auth/components/session-hydrate'

interface SessionProviderProps {
  children: ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <>
      <SessionHydrate />
      {children}
    </>
  )
}
