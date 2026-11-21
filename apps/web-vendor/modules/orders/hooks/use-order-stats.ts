import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'

export function useOrderStats(params: Record<string, string>) {
  return useQuery({
    queryKey: ['vendor-order-stats', params],
    queryFn: () => ordersService.getOrderStats(params),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })
}
