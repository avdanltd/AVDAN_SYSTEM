import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { ordersService } from '../services/orders.service'

export function useRejectOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      ordersService.rejectOrder(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-orders'] })
      toast.success('Order rejected')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to reject order')
    },
  })
}
