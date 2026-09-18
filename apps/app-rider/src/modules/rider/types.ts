import type { OrderStatus } from '@avdan/types'

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
  status: OrderStatus
  total_kobo: number
  /** What this rider is paid for this delivery — the flat delivery fee, 100% of it, no
   * commission taken (see `PaymentService.release_rider_payout`). Never the order total. */
  delivery_fee_kobo: number
  delivery_address: {
    street?: string
    city?: string
    state?: string
    [key: string]: unknown
  }
  hub_id: string | null
  hub_name: string | null
  hub_lat: number | null
  hub_lng: number | null
  items: OrderItem[]
  created_at: string
  updated_at: string
}

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

export interface EarningsSummary {
  total_earned_kobo: number
  pending_kobo: number
  deliveries_paid: number
}

export interface RiderPayout {
  id: string
  order_id: string
  amount_kobo: number
  status: 'PENDING' | 'PAYOUT_PENDING' | 'RELEASED' | 'FAILED'
  created_at: string
}

export interface PaginatedRiderPayouts {
  items: RiderPayout[]
  total: number
  page: number
  page_size: number
}

export type RiderOrderAction = 'pickup' | 'transit' | 'arrived-at-hub' | 'confirm-pickup' | 'deliver' | 'fail'

export const ORDER_ACTIONS: Record<
  string,
  { action: RiderOrderAction; label: string; variant: 'default' | 'destructive' }[]
> = {
  READY_FOR_PICKUP: [{ action: 'pickup', label: 'Confirm Pickup', variant: 'default' }],
  PICKED_UP: [{ action: 'transit', label: 'Mark In Transit to Hub', variant: 'default' }],
  IN_TRANSIT_TO_HUB: [{ action: 'arrived-at-hub', label: 'Mark Arrived at Hub', variant: 'default' }],
  // The hub agent's QA-pass action now stops at QA_PASSED (services/qa/service.py) instead of
  // auto-chaining to OUT_FOR_DELIVERY, so the rider must independently confirm they've collected
  // the parcel back from the hub before heading to the customer.
  QA_PASSED: [{ action: 'confirm-pickup', label: 'Confirm Pickup from Hub', variant: 'default' }],
  OUT_FOR_DELIVERY: [
    { action: 'deliver', label: 'Confirm Delivered', variant: 'default' },
    { action: 'fail', label: 'Report Failed Delivery', variant: 'destructive' },
  ],
}
