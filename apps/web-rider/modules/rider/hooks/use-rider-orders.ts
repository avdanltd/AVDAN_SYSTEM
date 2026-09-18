import { useQuery } from '@tanstack/react-query'

import { riderService } from '../services/rider.service'

export function useRiderOrders() {
  return useQuery({
    queryKey: ['rider-orders'],
    queryFn: () => riderService.getOrders(),
    refetchInterval: 15_000,
  })
}

/** Completed / terminal orders. Polled far less aggressively — history doesn't move. */
export function useRiderOrderHistory() {
  return useQuery({
    queryKey: ['rider-order-history'],
    queryFn: () => riderService.getOrderHistory(),
    staleTime: 60_000,
  })
}
