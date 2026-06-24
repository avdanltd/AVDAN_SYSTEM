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

export const ORDER_ACTIONS: Record<string, { action: RiderOrderAction; label: string; variant: 'default' | 'destructive' }[]> = {
  READY_FOR_PICKUP: [{ action: 'pickup', label: 'Confirm Pickup', variant: 'default' }],
  PICKED_UP: [{ action: 'transit', label: 'Mark In Transit to Hub', variant: 'default' }],
  QA_PASSED: [{ action: 'deliver', label: 'Start Last Mile Delivery', variant: 'default' }],
  OUT_FOR_DELIVERY: [
    { action: 'deliver', label: 'Confirm Delivered', variant: 'default' },
    { action: 'fail', label: 'Report Failed Delivery', variant: 'destructive' },
  ],
}
