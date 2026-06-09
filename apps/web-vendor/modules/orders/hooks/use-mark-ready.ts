import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { ordersService } from '../services/orders.service'

export function useMarkReady() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => ordersService.markReady(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-orders'] })
      toast.success('Order marked as ready for pickup!')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to update order')
    },
  })
}
