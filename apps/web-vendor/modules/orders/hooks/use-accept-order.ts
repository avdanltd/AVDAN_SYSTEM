import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { ordersService } from '../services/orders.service'

export function useAcceptOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => ordersService.acceptOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-orders'] })
      toast.success('Order accepted — start preparing!')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to accept order')
    },
  })
}
