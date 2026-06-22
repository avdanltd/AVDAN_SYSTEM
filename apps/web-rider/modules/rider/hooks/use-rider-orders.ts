import { useQuery } from '@tanstack/react-query'

import { riderService } from '../services/rider.service'

export function useRiderOrders() {
  return useQuery({
    queryKey: ['rider-orders'],
    queryFn: () => riderService.getOrders(),
    refetchInterval: 15_000,
  })
}
