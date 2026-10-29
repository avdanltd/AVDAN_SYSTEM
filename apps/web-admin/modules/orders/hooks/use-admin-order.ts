import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'

export function useAdminOrder(id: string) {
  return useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => ordersService.getOrder(id),
    enabled: !!id,
  })
}
