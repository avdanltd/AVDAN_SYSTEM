import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'

export function useAdminOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-orders', params],
    queryFn: () => ordersService.getOrders(params),
  })
}
