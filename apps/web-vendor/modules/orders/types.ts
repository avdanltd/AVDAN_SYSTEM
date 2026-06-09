import type { OrderStatus } from '@avdan/types'

export interface OrderItem {
  id: string
  product_id: string
  name: string
  price_kobo: number
  quantity: number
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
