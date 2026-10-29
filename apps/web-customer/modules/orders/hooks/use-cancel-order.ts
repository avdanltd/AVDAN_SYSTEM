import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => ordersService.cancelOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
