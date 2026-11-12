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

type WalletRangeParams = { date_from?: string; date_to?: string }

export const earningsService = {
  getSummary: () => apiClient.get<EarningsSummary>('/analytics/vendor'),
  getWallet: (range: { date_from?: string; date_to?: string } = {}) =>
    apiClient.get<WalletSummary>('/wallet/me', range),
  getEntries: (range: WalletRangeParams = {}, pageSize = 20, page = 1) =>
    apiClient.get<PaginatedResponse<WalletEntry>>('/wallet/me/entries', {
      ...range,
      page: String(page),
      page_size: String(pageSize),
    }),
  getRequests: (range: WalletRangeParams = {}, pageSize = 20, page = 1) =>
    apiClient.get<PaginatedResponse<PayoutRequest>>('/wallet/me/payout-requests', {
      ...range,
      page: String(page),
      page_size: String(pageSize),
    }),
  /** Every row in the range (for the CSV), fetched 100 at a time. */
  async exportAll(range: WalletRangeParams) {
    const requests: PayoutRequest[] = []
    const entries: WalletEntry[] = []
    for (let page = 1; page <= 50; page += 1) {
      const res = await earningsService.getRequests(range, 100, page)
      requests.push(...res.items)
      if (requests.length >= res.total || res.items.length === 0) break
    }
    for (let page = 1; page <= 50; page += 1) {
      const res = await earningsService.getEntries(range, 100, page)
      entries.push(...res.items)
      if (entries.length >= res.total || res.items.length === 0) break
    }
    return { requests, entries }
  },
  requestWithdrawal: (amountKobo: number) =>
    apiClient.post<PayoutRequest>('/wallet/me/payout-requests', { amount_kobo: amountKobo }),
}
