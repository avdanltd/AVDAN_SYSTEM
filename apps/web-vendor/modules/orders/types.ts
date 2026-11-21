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
  /** The customer's name only. The API withholds their address, phone, email and id from
   * vendors on purpose, so vendors don't deal with customers outside AVDAN. */
  customer_name?: string | null
  status: OrderStatus
  total_kobo: number
  created_at: string
  updated_at: string
  items?: OrderItem[]
  customer_note?: string | null
}
