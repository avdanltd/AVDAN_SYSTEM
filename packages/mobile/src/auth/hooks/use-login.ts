import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'

import { toast } from '../../lib/toast'
import { secureStorage } from '../../lib/secure-storage'
import { authService, type LoginPayload } from '../services/auth.service'
import { useAuthStore } from '../store/auth.store'

export function useLogin() {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  const router = useRouter()

  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: async (data) => {
      if (data.access_token && data.refresh_token) {
        await secureStorage.setTokens(data.access_token, data.refresh_token)
      }
      try {
        const user = await authService.getMe()
        setUser(user)
        await queryClient.invalidateQueries()
        router.replace('/')
      } catch {
        router.replace('/')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
