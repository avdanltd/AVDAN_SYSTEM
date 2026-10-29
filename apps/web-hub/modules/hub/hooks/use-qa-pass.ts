import { useMutation, useQueryClient } from '@tanstack/react-query'
import { hubService } from '../services/hub.service'
import { toast } from '@avdan/ui'

interface QaPassPayload {
  orderId: string
  notes: string
}

export function useQaPass() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orderId, notes }: QaPassPayload) => hubService.qaPass(orderId, notes),
    onSuccess: (_data, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['hub-inbound'] })
      void queryClient.invalidateQueries({ queryKey: ['hub-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['hub-order', orderId] })
      toast.success('QA passed — order dispatched for delivery')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to submit QA pass')
    },
  })
}
