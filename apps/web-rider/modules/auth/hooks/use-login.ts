import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from '@avdan/ui'

import { authService, type LoginPayload } from '../services/auth.service'
import { useAuthStore } from '../store/auth.store'

export function useLogin() {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  const router = useRouter()

  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: async () => {
      try {
        const user = await authService.getMe()
        setUser(user)
        await queryClient.invalidateQueries()
        router.push('/')
      } catch {
        router.push('/')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
