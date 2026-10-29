import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['vendor-order', id],
    queryFn: () => ordersService.getOrder(id),
    enabled: Boolean(id),
  })
}
