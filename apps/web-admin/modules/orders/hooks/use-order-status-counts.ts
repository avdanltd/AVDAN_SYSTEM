import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'

/** Orders per exact status for the chosen period (the numbers in the status dropdown). */
export function useOrderStatusCounts(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-order-status-counts', params],
    queryFn: () => ordersService.getStatusCounts(params),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })
}
