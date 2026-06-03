'use client'

import { useRef } from 'react'
import type { User } from '../services/auth.service'
import { useAuthStore } from '../store/auth.store'

export function SessionHydrate({ user }: { user: User | null }) {
  const initialized = useRef(false)

  if (!initialized.current) {
    initialized.current = true
    if (user) {
      useAuthStore.setState({ user, isAuthenticated: true })
    }
  }

  return null
}
