import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { riderService } from '../services/rider.service'
import type { RiderProfile } from '../types'
import { toast } from '@avdan/mobile'

/** The rider's own record — the source of truth for online/offline across app restarts. */
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
    // Flip the cached profile immediately so the toggle doesn't wait on a round trip,
    // and roll back if the server rejects it.
    onMutate: async (online) => {
      await queryClient.cancelQueries({ queryKey: ['rider-profile'] })
      const previous = queryClient.getQueryData<RiderProfile>(['rider-profile'])
      if (previous) {
        queryClient.setQueryData<RiderProfile>(['rider-profile'], { ...previous, online })
      }
      return { previous }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['rider-profile'], data)
      toast.success(
        data.online ? 'You are now online' : 'You are now offline',
        data.online ? 'Dispatch can assign you deliveries.' : 'You will not receive new assignments.',
      )
    },
    onError: (error: Error, _online, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['rider-profile'], context.previous)
      }
      toast.error('Could not update availability', error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-profile'] })
    },
  })
}
