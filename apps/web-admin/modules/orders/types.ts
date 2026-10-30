import type { OrderStatus } from '@avdan/types'

export interface AdminOrder {
  id: string
  customer_id: string
  vendor_id: string
  rider_id: string | null
  rider_name?: string | null
  rider_phone?: string | null
  hub_id?: string | null
  hub_name?: string | null
  hub_address?: string | null
  hub_description?: string | null
  hub_lat?: number | null
  hub_lng?: number | null
  status: OrderStatus
  total_kobo: number
  delivery_fee_kobo: number
  /** How the fee was worked out; method "flat" means a location was missing so no distance was used. */
  delivery_quote?: { method?: string; total_km?: number | null } | null
  delivery_address: Record<string, unknown>
  created_at: string
  updated_at: string
  items?: AdminOrderItem[]
  events?: AdminOrderEvent[]
}

export interface AdminOrderItem {
  id: string
  product_id: string
  product_name: string
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
