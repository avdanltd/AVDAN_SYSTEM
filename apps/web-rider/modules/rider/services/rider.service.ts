import { apiClient } from '@/lib/api-client'
import type {
  Bank,
  EarningsSummary,
  PaginatedRiderPayouts,
  PayoutAccount,
  RiderProfile,
  RiderOrder,
  VerifiedAccount,
} from '../types'

export const riderService = {
  getProfile: () => apiClient.get<RiderProfile>('/dispatch/me'),

  setAvailability: (online: boolean) =>
    apiClient.post<RiderProfile>('/dispatch/me/availability', { online }),

  broadcastLocation: (lat: number, lng: number) =>
    apiClient.post<RiderProfile>('/dispatch/me/location', { lat, lng }),

  getOrders: () =>
    apiClient.get<RiderOrder[]>('/dispatch/me/orders'),

  /** Terminal-state orders this rider handled, newest first. */
  getOrderHistory: (limit = 50, offset = 0) =>
    apiClient.get<RiderOrder[]>('/dispatch/me/orders/history', {
      limit: String(limit),
      offset: String(offset),
    }),

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

  getEarningsSummary: () => apiClient.get<EarningsSummary>('/dispatch/me/earnings'),

  getPayoutHistory: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedRiderPayouts>('/dispatch/me/payouts', {
      page: String(page),
      page_size: String(pageSize),
    }),

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
}
