'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../store/auth.store'

export function SessionHydrate() {
  const setUser = useAuthStore((s) => s.setUser)

  const { data: user } = useQuery({
    queryKey: ['session'],
    queryFn: () => authService.getMe(),
    retry: false,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (user) setUser(user)
  }, [user, setUser])

  return null
}
