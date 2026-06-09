import { useQuery } from '@tanstack/react-query'
import { analyticsService } from '../services/analytics.service'

export function useOrderVolume(period: 'day' | 'week' | 'month' = 'month') {
  return useQuery({
    queryKey: ['admin-analytics-order-volume', period],
    queryFn: () => analyticsService.getOrderVolume(period),
  })
}
