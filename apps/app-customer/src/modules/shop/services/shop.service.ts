import type { DeliveryQuote, OrderReviews, ReviewPage, SubmitReviewsInput } from '@avdan/types'
import { apiClient } from '@avdan/mobile'

import type {
  Category,
  CustomerOrder,
  DeliveryAddress,
  InitiatePaymentResult,
  PaginatedOrders,
  PaginatedProducts,
  PendingDeliveryCode,
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
  getReviews: (target: 'product' | 'vendor', id: string, page: number) =>
    apiClient.get<ReviewPage>(`/reviews/${target}s/${id}`, { page: String(page), page_size: '5' }),
  getOrderReviews: (orderId: string) => apiClient.get<OrderReviews>(`/reviews/orders/${orderId}`),
  submitOrderReviews: (orderId: string, body: SubmitReviewsInput) =>
    apiClient.post<OrderReviews>(`/reviews/orders/${orderId}`, body),

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

  /** Orders on the road whose handover code the customer still has to give the rider. */
  getPendingDeliveryCodes: () =>
    apiClient.get<PendingDeliveryCode[]>('/orders/pending-delivery-codes'),

  createOrder: (payload: {
    vendor_id: string
    items: { product_id: string; quantity: number }[]
    delivery_address: DeliveryAddress
  }) => apiClient.post<CustomerOrder>('/orders', payload),

  getDeliveryQuote: (vendorId: string, lat: number, lng: number, items: string) =>
    apiClient.get<DeliveryQuote>('/orders/delivery-quote', {
      vendor_id: vendorId,
      lat: String(lat),
      lng: String(lng),
      // The cart as "product_id:qty,…", so products with a special delivery fee are priced in.
      items,
    }),

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
