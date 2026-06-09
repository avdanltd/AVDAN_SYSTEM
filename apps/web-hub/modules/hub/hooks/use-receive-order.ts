import { useMutation, useQueryClient } from '@tanstack/react-query'
import { hubService } from '../services/hub.service'
import { toast } from '@avdan/ui'

export function useReceiveOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: string) => hubService.receiveOrder(orderId),
    onSuccess: (_data, orderId) => {
      void queryClient.invalidateQueries({ queryKey: ['hub-inbound'] })
      void queryClient.invalidateQueries({ queryKey: ['hub-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['hub-order', orderId] })
      toast.success('Order received — ready for QA inspection')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to receive order')
    },
  })
}
