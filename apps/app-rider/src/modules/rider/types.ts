export interface RiderProfile {
  id: string
  user_id: string
  zone_id: string | null
  online: boolean
  vehicle_type: string | null
  lat: number | null
  lng: number | null
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

export interface RiderOrder {
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

export type RiderOrderAction = 'pickup' | 'transit' | 'deliver' | 'fail'

export const ORDER_ACTIONS: Record<
  string,
  { action: RiderOrderAction; label: string; variant: 'default' | 'destructive' }[]
> = {
  READY_FOR_PICKUP: [{ action: 'pickup', label: 'Confirm Pickup', variant: 'default' }],
  PICKED_UP: [{ action: 'transit', label: 'Mark In Transit to Hub', variant: 'default' }],
  // No QA_PASSED entry: the hub QA flow advances QA_IN_PROGRESS → QA_PASSED → OUT_FOR_DELIVERY
  // in a single agent-triggered request (services/qa/service.py:120-126), so an order never rests
  // in QA_PASSED for a rider to act on. The button that used to live here called /deliver, which
  // the state machine rejects from QA_PASSED (only → OUT_FOR_DELIVERY is legal) — a guaranteed error.
  OUT_FOR_DELIVERY: [
    { action: 'deliver', label: 'Confirm Delivered', variant: 'default' },
    { action: 'fail', label: 'Report Failed Delivery', variant: 'destructive' },
  ],
}
