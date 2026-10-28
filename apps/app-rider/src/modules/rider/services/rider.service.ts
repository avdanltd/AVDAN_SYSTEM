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

  deliverOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/deliver`),

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

  getWallet: () => apiClient.get<WalletSummary>('/wallet/me'),

  getWalletEntries: () =>
    apiClient.get<PaginatedResponse<WalletEntry>>('/wallet/me/entries', { page_size: '20' }),

  getPayoutRequests: () =>
    apiClient.get<PaginatedResponse<PayoutRequest>>('/wallet/me/payout-requests', { page_size: '20' }),

  requestWithdrawal: (amountKobo: number) =>
    apiClient.post<PayoutRequest>('/wallet/me/payout-requests', { amount_kobo: amountKobo }),
}
