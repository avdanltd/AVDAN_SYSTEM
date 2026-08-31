import { apiClient } from '@avdan/mobile'

import type {
  Category,
  CustomerOrder,
  DeliveryAddress,
  InitiatePaymentResult,
  PaginatedOrders,
  PaginatedProducts,
  Product,
  ProductSort,
  Vendor,
  VendorDetail,
  VerifyPaymentResult,
} from '../types'

export interface ProductQuery {
  page?: number
  pageSize?: number
  categoryId?: string
  vendorId?: string
  search?: string
  sort?: ProductSort
}

function productParams(q: ProductQuery): Record<string, string> {
  const p: Record<string, string> = {
    page: String(q.page ?? 1),
    page_size: String(q.pageSize ?? 20),
  }
  if (q.categoryId) p.category_id = q.categoryId
  if (q.vendorId) p.vendor_id = q.vendorId
  if (q.search) p.search = q.search
  if (q.sort) p.sort = q.sort
  return p
}

export const shopService = {
  /* ── Catalogue ──────────────────────────────────────────────────────────── */
  getProducts: (q: ProductQuery = {}) =>
    apiClient.get<PaginatedProducts>('/products', productParams(q)),

  getProduct: (id: string) => apiClient.get<Product>(`/products/${id}`),

  getCategories: () => apiClient.get<Category[]>('/categories'),

  getVendors: (page = 1, pageSize = 20) =>
    apiClient.get<{ items: Vendor[]; total: number }>('/vendors', {
      page: String(page),
      page_size: String(pageSize),
    }),

  getVendor: (slug: string) => apiClient.get<VendorDetail>(`/vendors/${slug}`),

  /** Semantic search — falls back to trigram matching server-side. */
  search: (q: string, type: 'all' | 'products' | 'vendors' = 'all', limit = 20) =>
    apiClient.get<{ products: Product[]; vendors: Vendor[] }>('/search', {
      q,
      type,
      limit: String(limit),
    }),

  /* ── Orders ─────────────────────────────────────────────────────────────── */
  getOrders: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedOrders>('/orders', {
      page: String(page),
      page_size: String(pageSize),
    }),

  getOrder: (id: string) => apiClient.get<CustomerOrder>(`/orders/${id}`),

  createOrder: (payload: {
    vendor_id: string
    items: { product_id: string; quantity: number }[]
    delivery_address: DeliveryAddress
  }) => apiClient.post<CustomerOrder>('/orders', payload),

  cancelOrder: (id: string) => apiClient.post<CustomerOrder>(`/orders/${id}/cancel`, {}),

  /* ── Payment ────────────────────────────────────────────────────────────── */
  initiatePayment: (orderId: string) =>
    apiClient.post<InitiatePaymentResult>(`/payment/initiate/${orderId}`, {}),

  /**
   * Confirm a payment straight from Paystack.
   *
   * Called as soon as the checkout browser closes, so the app never has to wait for a webhook to
   * arrive before it can tell the customer whether payment worked. Idempotent server-side.
   */
  verifyPayment: (reference: string) =>
    apiClient.post<VerifyPaymentResult>(`/payment/verify/${reference}`, {}),
}
