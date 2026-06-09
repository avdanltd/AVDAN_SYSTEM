import { apiClient } from '@/lib/api-client'
import type { User } from '@/modules/auth/services/auth.service'

export interface UpdateUserPayload {
  name?: string
  email?: string
  phone?: string
}

export interface UpdateVendorPayload {
  name?: string
  description?: string
}

export interface VendorMeResponse {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  rating: number | null
  products: unknown[]
  has_payout_account: boolean
  payout_bank_name: string | null
  payout_account_name: string | null
}

export interface Bank {
  name: string
  code: string
}

export interface VerifyAccountResponse {
  account_name: string
  account_number: string
}

export interface PayoutAccountResponse {
  has_payout_account: boolean
  account_number: string | null
  bank_name: string | null
  account_name: string | null
}

export interface SavePayoutAccountPayload {
  account_number: string
  bank_code: string
  bank_name: string
  account_name: string
}

export const profileService = {
  getMe: () => apiClient.get<User>('/auth/me'),
  updateMe: (data: UpdateUserPayload) => apiClient.patch<User>('/auth/me', data),
  getVendorProfile: () => apiClient.get<VendorMeResponse>('/vendors/me'),
  updateVendorProfile: (data: UpdateVendorPayload) =>
    apiClient.patch<VendorMeResponse>('/vendors/me', data),
  getBanks: () => apiClient.get<Bank[]>('/vendors/me/banks'),
  verifyAccount: (data: { account_number: string; bank_code: string }) =>
    apiClient.post<VerifyAccountResponse>('/vendors/me/payout-account/verify', data),
  getPayoutAccount: () => apiClient.get<PayoutAccountResponse>('/vendors/me/payout-account'),
  savePayoutAccount: (data: SavePayoutAccountPayload) =>
    apiClient.post<PayoutAccountResponse>('/vendors/me/payout-account', data),
}
