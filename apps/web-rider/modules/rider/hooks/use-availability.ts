import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { riderService } from '../services/rider.service'

export function useAvailability() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (online: boolean) => riderService.setAvailability(online),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rider-profile'] })
      toast.success(data.online ? 'You are now online' : 'You are now offline')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
