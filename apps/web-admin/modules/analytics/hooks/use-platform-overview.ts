import { useQuery } from '@tanstack/react-query'
import { analyticsService } from '../services/analytics.service'

export function usePlatformOverview() {
  return useQuery({
    queryKey: ['admin-analytics-overview'],
    queryFn: () => analyticsService.getOverview(),
    refetchInterval: 30_000,
  })
}
