import { useMutation, useQueryClient } from '@tanstack/react-query'
import { disputesService } from '../services/disputes.service'
import type { ResolveDisputePayload } from '../types'
import { toast } from '@avdan/ui'

export function useResolveDispute(disputeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ResolveDisputePayload) => disputesService.resolve(disputeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dispute', disputeId] })
      toast.success('Dispute resolved successfully.')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to resolve dispute.')
    },
  })
}
