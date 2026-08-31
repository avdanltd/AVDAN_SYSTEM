import type {
  Bank,
  Category,
  PaginatedOrders,
  Product,
  VendorAnalytics,
  VendorDetail,
  PayoutAccount,
  VendorOrder,
  VerifiedAccount,
} from '../types'
import { apiClient } from '@avdan/mobile'

export interface CreateProductPayload {
  name: string
  description?: string | null
  price_kobo: number
  stock_qty: number
  image_urls: string[]
  category_id?: string | null
}

export const vendorService = {
  /* ── Storefront ─────────────────────────────────────────────────────────── */
  /** Returns the storefront AND its products — there is no GET /vendors/me/products. */
  getProfile: () => apiClient.get<VendorDetail>('/vendors/me'),

  updateProfile: (payload: { name?: string; description?: string | null; logo_url?: string | null }) =>
    apiClient.patch<VendorDetail>('/vendors/me', payload),

  /* ── Orders ─────────────────────────────────────────────────────────────── */
  // The backend's status filter takes a single value, so the app pulls a page and splits it
  // into active/completed client-side rather than firing one request per status.
  getOrders: (page = 1, pageSize = 100) =>
    apiClient.get<PaginatedOrders>('/orders/vendor/incoming', {
      page: String(page),
      page_size: String(pageSize),
    }),

  getOrder: (orderId: string) => apiClient.get<VendorOrder>(`/orders/vendor/${orderId}`),

  /** PAID → VENDOR_ACCEPTED → PREPARING, in one request. */
  acceptOrder: (orderId: string) =>
    apiClient.post<VendorOrder>(`/orders/vendor/${orderId}/accept`, {}),

  rejectOrder: (orderId: string, reason: string) =>
    apiClient.post<VendorOrder>(`/orders/vendor/${orderId}/reject`, { reason }),

  markReady: (orderId: string) =>
    apiClient.post<VendorOrder>(`/orders/vendor/${orderId}/ready`, {}),

  /* ── Catalog ────────────────────────────────────────────────────────────── */
  // Product listing comes from getProfile() above; the API has no list-my-products route.
  createProduct: (payload: CreateProductPayload) =>
    apiClient.post<Product>('/vendors/me/products', payload),

  updateProduct: (productId: string, payload: Partial<CreateProductPayload>) =>
    apiClient.patch<Product>(`/vendors/me/products/${productId}`, payload),

  deleteProduct: (productId: string) => apiClient.delete<void>(`/vendors/me/products/${productId}`),

  setAvailability: (productId: string, available: boolean) =>
    apiClient.patch<Product>(`/vendors/me/products/${productId}/availability`, { available }),

  getCategories: () => apiClient.get<Category[]>('/categories'),

  /* ── Earnings ───────────────────────────────────────────────────────────── */
  getAnalytics: () => apiClient.get<VendorAnalytics>('/analytics/vendor'),

  /* ── Payout ─────────────────────────────────────────────────────────────── */
  getBanks: () => apiClient.get<Bank[]>('/vendors/me/banks'),

  /** Resolve an account number to the real account name, before anything is saved. */
  verifyAccount: (accountNumber: string, bankCode: string) =>
    apiClient.post<VerifiedAccount>('/vendors/me/payout-account/verify', {
      account_number: accountNumber,
      bank_code: bankCode,
    }),

  savePayoutAccount: (payload: {
    account_number: string
    bank_code: string
    bank_name: string
    account_name: string
  }) => apiClient.post<PayoutAccount>('/vendors/me/payout-account', payload),

  getPayoutAccount: () => apiClient.get<PayoutAccount>('/vendors/me/payout-account'),
}
