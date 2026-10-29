import type { PayoutRequest, PaginatedResponse, WalletEntry, WalletSummary } from '@avdan/types'

import { apiClient } from '@/lib/api-client'

export interface EarningsSummary {
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

export const earningsService = {
  getSummary: () => apiClient.get<EarningsSummary>('/analytics/vendor'),
  getWallet: () => apiClient.get<WalletSummary>('/wallet/me'),
  getEntries: () => apiClient.get<PaginatedResponse<WalletEntry>>('/wallet/me/entries', { page_size: '20' }),
  getRequests: () =>
    apiClient.get<PaginatedResponse<PayoutRequest>>('/wallet/me/payout-requests', { page_size: '20' }),
  requestWithdrawal: (amountKobo: number) =>
    apiClient.post<PayoutRequest>('/wallet/me/payout-requests', { amount_kobo: amountKobo }),
}
