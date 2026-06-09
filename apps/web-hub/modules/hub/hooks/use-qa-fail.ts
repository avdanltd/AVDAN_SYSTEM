import { useMutation, useQueryClient } from '@tanstack/react-query'
import { hubService } from '../services/hub.service'
import { toast } from '@avdan/ui'

interface QaFailPayload {
  orderId: string
  notes: string
  evidence_urls: string[]
}

export function useQaFail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orderId, notes, evidence_urls }: QaFailPayload) =>
      hubService.qaFail(orderId, notes, evidence_urls),
    onSuccess: (_data, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['hub-inbound'] })
      void queryClient.invalidateQueries({ queryKey: ['hub-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['hub-order', orderId] })
      toast.success('QA failure recorded — order returned to vendor')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to submit QA failure')
    },
  })
}
