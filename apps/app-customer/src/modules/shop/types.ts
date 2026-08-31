export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
}

/** Mirrors PublicProductResponse — the shape `GET /products` returns. */
export interface Product {
  id: string
  vendor_id: string
  vendor_name: string
  vendor_slug: string
  category_id: string | null
  category_name: string | null
  name: string
  description: string | null
  price_kobo: number
  available: boolean
  stock_qty: number
  image_urls: string[]
  created_at: string
}

export interface PaginatedProducts {
  items: Product[]
  total: number
  page: number
  page_size: number
}

export interface Vendor {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  status: string
  rating: number
  created_at: string
}

export interface VendorDetail extends Vendor {
  products: Array<{
    id: string
    name: string
    description: string | null
    price_kobo: number
    available: boolean
    stock_qty: number
    image_urls: string[]
    category_name: string | null
  }>
}

export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  product_image_url: string | null
  price_kobo: number
  quantity: number
  subtotal_kobo: number
}

export interface OrderEvent {
  from_state: string | null
  to_state: string
  actor_role: string | null
  created_at: string
}

export interface DeliveryAddress {
  street: string
  city: string
  state: string
  country?: string
  notes?: string | null
}

export interface CustomerOrder {
  id: string
  customer_id: string
  vendor_id: string
  vendor_name?: string | null
  status: string
  total_kobo: number
  delivery_address: DeliveryAddress
  items: OrderItem[]
  created_at: string
  updated_at: string
  events?: OrderEvent[]
}

export interface PaginatedOrders {
  items: CustomerOrder[]
  total: number
  page: number
  page_size: number
}

export interface InitiatePaymentResult {
  payment_url: string
  reference: string
  escrow_id: string
}

export interface VerifyPaymentResult {
  paid: boolean
  order_id: string
  status: string
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'popular'

/**
 * A line in the cart.
 *
 * The vendor is captured per item because `POST /orders` accepts a single `vendor_id` — the
 * backend has no concept of a basket spanning vendors. The cart therefore groups by vendor and
 * checks out one vendor at a time; see `cart.store.ts`.
 */
export interface CartLine {
  productId: string
  name: string
  priceKobo: number
  quantity: number
  imageUrl: string | null
  stockQty: number
  vendorId: string
  vendorName: string
}
