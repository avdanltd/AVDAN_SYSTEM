import type { OrderStatus } from '@avdan/types'

export interface AdminOrder {
  id: string
  customer_id: string
  vendor_id: string
  rider_id: string | null
  status: OrderStatus
  total_kobo: number
  delivery_address: Record<string, unknown>
  created_at: string
  updated_at: string
  items?: AdminOrderItem[]
  events?: AdminOrderEvent[]
}

export interface AdminOrderItem {
  id: string
  product_id: string
  name: string
  price_kobo: number
  quantity: number
}

export interface AdminOrderEvent {
  id: string
  from_state: string | null
  to_state: string
  actor_role: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
