import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'

export function useOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => ordersService.getOrders(params),
    staleTime: 15_000,
  })
}
