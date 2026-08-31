/** Mirrors VendorDetailResponse — `GET /vendors/me` embeds the vendor's products and payout
 *  state, so there is no separate list-my-products endpoint to call. */
export interface VendorDetail extends VendorProfile {
  products: Product[]
  has_payout_account: boolean
  payout_bank_name: string | null
  payout_account_name: string | null
}

/** Mirrors VendorResponse in services/vendor/schemas.py. */
export interface VendorProfile {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  status: string
  zone_id: string | null
  rating: number
  created_at: string
}

export interface Product {
  id: string
  vendor_id: string
  category_id: string | null
  category_name: string | null
  name: string
  description: string | null
  price_kobo: number
  available: boolean
  stock_qty: number
  image_urls: string[]
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
}

export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  /** Snapshot of the product's primary image at order time (migration 0015). */
  product_image_url: string | null
  price_kobo: number
  quantity: number
  subtotal_kobo: number
}

export interface VendorOrder {
  id: string
  customer_id: string
  vendor_id: string
  status: string
  total_kobo: number
  delivery_address: {
    street?: string
    city?: string
    state?: string
    [key: string]: unknown
  }
  items: OrderItem[]
  created_at: string
  updated_at: string
}

export interface PaginatedOrders {
  items: VendorOrder[]
  total: number
  page: number
  page_size: number
}

export interface VendorAnalytics {
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

export type VendorOrderAction = 'accept' | 'reject' | 'ready'

/**
 * What the vendor can do from each status. `PAID` is the only state that offers a choice —
 * accepting advances two states in one request (PAID → VENDOR_ACCEPTED → PREPARING, see
 * `OrderService.accept_order`), which is why there is no separate "start preparing" action.
 */
export const ORDER_ACTIONS: Record<
  string,
  { action: VendorOrderAction; label: string; variant: 'default' | 'destructive' }[]
> = {
  PAID: [
    { action: 'accept', label: 'Accept order', variant: 'default' },
    { action: 'reject', label: 'Reject order', variant: 'destructive' },
  ],
  PREPARING: [{ action: 'ready', label: 'Mark ready for pickup', variant: 'default' }],
}

/**
 * Orders the vendor still has to act on or is still responsible for.
 * PENDING is included deliberately: `/orders/vendor/incoming` returns unpaid orders too, and
 * filing those under "Completed" would be plainly wrong — the customer simply has not paid yet.
 */
export const ACTIVE_STATUSES = new Set([
  'PENDING',
  'PAID',
  'VENDOR_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'VENDOR_REMEDIATION',
])

/* ── Payout ───────────────────────────────────────────────────────────────── */

export interface Bank {
  name: string
  code: string
}

export interface VerifiedAccount {
  account_name: string
  account_number: string
}

export interface PayoutAccount {
  has_payout_account: boolean
  account_number: string | null
  bank_name: string | null
  account_name: string | null
}
