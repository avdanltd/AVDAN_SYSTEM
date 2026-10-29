'use client'

import { useEffect } from 'react'
import { authService } from '@/modules/auth/services/auth.service'
import { useAuthStore } from '@/modules/auth/store/auth.store'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (!user) {
      authService.getMe().then(setUser).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
