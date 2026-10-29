import { useQuery } from '@tanstack/react-query'

import { riderService } from '../services/rider.service'

/** The rider's active work queue — orders still awaiting an action. */
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

/**
 * A single order by id, fetched directly rather than filtered out of the active list.
 * The detail screen used to read from the active list, so an order rendered "not found"
 * the moment it was delivered and left that list.
 */
export function useRiderOrder(orderId: string) {
  return useQuery({
    queryKey: ['rider-order', orderId],
    queryFn: () => riderService.getOrder(orderId),
    enabled: !!orderId,
  })
}
