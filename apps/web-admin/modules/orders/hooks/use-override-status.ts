import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'
import { toast } from '@avdan/ui'

export function useOverrideStatus(orderId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ status, reason }: { status: string; reason: string }) =>
      ordersService.overrideStatus(orderId, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-order', orderId] })
      toast.success('Order status overridden successfully.')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to override order status.')
    },
  })
}
