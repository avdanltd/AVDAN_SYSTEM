import type { OrderStatus } from '@avdan/types'

export interface HubOrder {
  id: string
  status: OrderStatus
  vendor_id: string
  vendor_name?: string
  customer_id: string
  total_kobo: number
  items?: Array<{ id: string; product_name: string; quantity: number; price_kobo: number; subtotal_kobo: number }>
  created_at: string
  updated_at: string
  arrived_at?: string | null
}

export interface HubStats {
  inbound_today: number
  qa_pending: number
  dispatched_today: number
  qa_pass_rate: number
}

export interface QaInspection {
  id: string
  order_id: string
  result: 'pass' | 'fail'
  notes: string | null
  evidence_urls: string[]
  created_at: string
}
