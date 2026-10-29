import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'

import { secureStorage } from '../../lib/secure-storage'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../store/auth.store'

export function useLogout() {
  const queryClient = useQueryClient()
  const clearUser = useAuthStore((s) => s.clearUser)
  const router = useRouter()

  return useMutation({
    mutationFn: async () => {
      // Best-effort, and before logout — the token is still valid for this one call.
      await authService.clearPushToken().catch(() => {})
      return authService.logout()
    },
    onSettled: async () => {
      await secureStorage.clear()
      clearUser()
      queryClient.clear()
      router.replace('/login')
    },
  })
}
