import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from '@avdan/ui'

import { authService, type LoginPayload } from '../services/auth.service'
import { useAuthStore } from '../store/auth.store'

// Where the auth gate sent the user from (?from=/checkout). Same-site paths only, so the
// param can't be used as an open redirect.
function postLoginPath(): string {
  const from = new URLSearchParams(window.location.search).get('from')
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

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
        router.push(postLoginPath())
      } catch {
        router.push(postLoginPath())
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
