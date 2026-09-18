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

// Mirrors `HubAnalyticsResponse` in `apps/api/services/qa/schemas.py` exactly — the previous
// version of this type (inbound_today/qa_pending/dispatched_today/qa_pass_rate) named fields the
// backend never returned, so every stat card silently rendered its `?? 0`/`—` fallback forever.
export interface HubStats {
  hub_id: string
  hub_name: string
  period_days: number
  orders_processed: number
  qa_pass_count: number
  qa_fail_count: number
  qa_pass_rate_pct: number
  avg_dwell_minutes: number | null
}

export interface QaInspection {
  id: string
  order_id: string
  result: 'pass' | 'fail'
  notes: string | null
  evidence_urls: string[]
  created_at: string
}
