import { useMutation, useQueryClient } from '@tanstack/react-query'
import { profileService, type UpdateProfilePayload } from '../services/profile.service'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import { toast } from '@avdan/ui'

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileService.updateMe(payload),
    onSuccess: (updatedUser) => {
      setUser(updatedUser)
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success('Profile updated successfully')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update profile')
    },
  })
}
