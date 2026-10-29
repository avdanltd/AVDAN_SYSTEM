import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileService, type UpdateProfilePayload } from '../services/profile.service'
import { toast } from '@avdan/ui'

export function useProfile() {
  return useQuery({
    queryKey: ['admin-profile'],
    queryFn: () => profileService.getMe(),
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileService.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] })
      toast.success('Profile updated successfully.')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update profile.')
    },
  })
}
