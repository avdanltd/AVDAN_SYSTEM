import { useMutation } from '@tanstack/react-query'

import { toast } from '../../lib/toast'
import { authService, type User } from '../services/auth.service'
import { useAuthStore } from '../store/auth.store'

export function useUpdateProfile(onDone?: () => void) {
  const setUser = useAuthStore((s) => s.setUser)

  return useMutation({
    mutationFn: (payload: Partial<Pick<User, 'name' | 'phone'>>) => authService.updateMe(payload),
    onSuccess: (user) => {
      setUser(user)
      toast.success('Profile updated')
      onDone?.()
    },
    onError: (error: Error) => {
      // The backend rejects a phone already claimed by another account with a 409.
      toast.error('Could not save changes', error.message)
    },
  })
}
