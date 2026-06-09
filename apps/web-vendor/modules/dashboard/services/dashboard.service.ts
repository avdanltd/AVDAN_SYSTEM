import { apiClient } from '@/lib/api-client'

export interface VendorStats {
  orders_today: number
  revenue_today_kobo: number
  pending_orders: number
  avg_rating: number | null
}

export const dashboardService = {
  getStats: () => apiClient.get<VendorStats>('/analytics/vendor'),
}
