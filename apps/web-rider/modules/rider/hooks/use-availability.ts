import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { riderService } from '../services/rider.service'

/** The rider's own record — the source of truth for online/offline across page reloads. */
export function useRiderProfile() {
  return useQuery({
    queryKey: ['rider-profile'],
    queryFn: () => riderService.getProfile(),
    staleTime: 30_000,
  })
}

export function useAvailability() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (online: boolean) => riderService.setAvailability(online),
    onSuccess: (data) => {
      queryClient.setQueryData(['rider-profile'], data)
      toast.success(data.online ? 'You are now online' : 'You are now offline')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-profile'] })
    },
  })
}
