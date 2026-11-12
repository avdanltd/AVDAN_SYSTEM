import type { PaginatedResponse, PayoutRequest, WalletEntry, WalletSummary } from '@avdan/types'
import type {
  Bank,
  PayoutAccount,
  RiderProfile,
  RiderOrder,
  VerifiedAccount,
} from '../types'
import { apiClient } from '@avdan/mobile'

export const riderService = {
  getProfile: () => apiClient.get<RiderProfile>('/dispatch/me'),

  setAvailability: (online: boolean) =>
    apiClient.post<RiderProfile>('/dispatch/me/availability', { online }),

  broadcastLocation: (lat: number, lng: number) =>
    apiClient.post<RiderProfile>('/dispatch/me/location', { lat, lng }),

  getOrders: () => apiClient.get<RiderOrder[]>('/dispatch/me/orders'),

  /** Terminal-state orders this rider handled, newest first. */
  getOrderHistory: (limit = 50, offset = 0) =>
    apiClient.get<RiderOrder[]>('/dispatch/me/orders/history', {
      limit: String(limit),
      offset: String(offset),
    }),

  /** One order in any status — survives the order leaving the active queue. */
  getOrder: (orderId: string) => apiClient.get<RiderOrder>(`/dispatch/me/orders/${orderId}`),

  pickupOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/pickup`),

  transitOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/transit`),

  arrivedAtHub: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/arrived-at-hub`),

  confirmPickupFromHub: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/confirm-pickup`),

  // `code` is the delivery code the customer reads out at handover.
  deliverOrder: (orderId: string, code: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/deliver`, { code }),

  failOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/fail`),

  getBanks: () => apiClient.get<Bank[]>('/dispatch/me/banks'),

  /** Resolve an account number to the real account name, before anything is saved. */
  verifyAccount: (accountNumber: string, bankCode: string) =>
    apiClient.post<VerifiedAccount>('/dispatch/me/payout-account/verify', {
      account_number: accountNumber,
      bank_code: bankCode,
    }),

  savePayoutAccount: (payload: {
    account_number: string
    bank_code: string
    bank_name: string
    account_name: string
  }) => apiClient.post<PayoutAccount>('/dispatch/me/payout-account', payload),

  getPayoutAccount: () => apiClient.get<PayoutAccount>('/dispatch/me/payout-account'),

  getWallet: (range: { date_from?: string; date_to?: string } = {}) =>
    apiClient.get<WalletSummary>('/wallet/me', range as Record<string, string>),

  getWalletEntries: (range: { date_from?: string; date_to?: string } = {}, pageSize = 20, page = 1) =>
    apiClient.get<PaginatedResponse<WalletEntry>>('/wallet/me/entries', {
      ...range,
      page: String(page),
      page_size: String(pageSize),
    }),

  getPayoutRequests: (range: { date_from?: string; date_to?: string } = {}, pageSize = 20, page = 1) =>
    apiClient.get<PaginatedResponse<PayoutRequest>>('/wallet/me/payout-requests', {
      ...range,
      page: String(page),
      page_size: String(pageSize),
    }),

  /** Every row in the range (for the CSV), fetched 100 at a time. */
  async exportWallet(range: { date_from?: string; date_to?: string }) {
    const requests: PayoutRequest[] = []
    const entries: WalletEntry[] = []
    for (let page = 1; page <= 50; page += 1) {
      const res = await riderService.getPayoutRequests(range, 100, page)
      requests.push(...res.items)
      if (requests.length >= res.total || res.items.length === 0) break
    }
    for (let page = 1; page <= 50; page += 1) {
      const res = await riderService.getWalletEntries(range, 100, page)
      entries.push(...res.items)
      if (entries.length >= res.total || res.items.length === 0) break
    }
    return { requests, entries }
  },

  requestWithdrawal: (amountKobo: number) =>
    apiClient.post<PayoutRequest>('/wallet/me/payout-requests', { amount_kobo: amountKobo }),
}
