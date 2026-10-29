import type { OrderStatus } from '@avdan/types'

export interface OrderItem {
  id: string
  product_id: string
  /** Snapshot of the product's name at order time (migration 0015). Was hand-typed as `name`
   * here, which never matched the real API field — every order card rendered a blank item name. */
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
  status: OrderStatus
  total_kobo: number
  delivery_address: Record<string, unknown>
  created_at: string
  updated_at: string
  items?: OrderItem[]
  customer_note?: string | null
}
