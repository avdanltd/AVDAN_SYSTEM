import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { hubDetailsService, type UpdateMyHubPayload } from '../services/hub-details.service'

const KEY = ['my-hub']

export function useMyHub() {
  return useQuery({ queryKey: KEY, queryFn: hubDetailsService.getMyHub })
}

export function useUpdateMyHub() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateMyHubPayload) => hubDetailsService.updateMyHub(payload),
    onSuccess: (hub) => {
      queryClient.setQueryData(KEY, hub)
      toast.success('Hub details saved')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save hub details'),
  })
}
