import { apiClient } from '@/lib/api-client'
import type { PlatformOverview, OrderVolumeResponse } from '../types'

export const analyticsService = {
  getOverview: () => apiClient.get<PlatformOverview>('/admin/analytics/overview'),
  getOrderVolume: (period: 'day' | 'week' | 'month' = 'month') =>
    apiClient.get<OrderVolumeResponse>('/admin/analytics/orders', { period }),
}
