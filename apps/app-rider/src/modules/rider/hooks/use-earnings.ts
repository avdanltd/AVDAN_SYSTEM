import { useQuery } from '@tanstack/react-query'

import { riderService } from '../services/rider.service'

export function useEarningsSummary() {
  return useQuery({
    queryKey: ['rider-earnings-summary'],
    queryFn: () => riderService.getEarningsSummary(),
  })
}

export function usePayoutHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['rider-payout-history', page, pageSize],
    queryFn: () => riderService.getPayoutHistory(page, pageSize),
  })
}
