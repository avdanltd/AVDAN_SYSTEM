import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { authService } from '../services/auth.service'
import { useAuthStore } from '../store/auth.store'

export function useLogout() {
  const queryClient = useQueryClient()
  const clearUser = useAuthStore((s) => s.clearUser)
  const router = useRouter()

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      clearUser()
      queryClient.clear()
      router.push('/login')
    },
  })
}
