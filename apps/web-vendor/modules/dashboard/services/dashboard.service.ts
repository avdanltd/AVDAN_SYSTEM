import { apiClient } from '@/lib/api-client'

export interface VendorStats {
  vendor_id: string
  total_orders: number
  active_orders: number
  completed_orders: number
  total_revenue_kobo: number
  pending_release_kobo: number
  commission_rate: number
  rejection_count: number
  rejection_rate_pct: number
}

export const dashboardService = {
  getStats: () => apiClient.get<VendorStats>('/analytics/vendor'),
}
