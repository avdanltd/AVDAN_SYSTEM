import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersService.getOrder(id),
    staleTime: 15_000,
    enabled: Boolean(id),
  })
}
