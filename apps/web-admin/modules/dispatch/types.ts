import type { OrderStatus } from '@avdan/types'

export interface DispatchOrder {
  id: string
  customer_id: string
  vendor_id: string
  status: OrderStatus
  total_kobo: number
  delivery_address: Record<string, string>
  items: Array<{
    id: string
    product_name: string
    quantity: number
    price_kobo: number
    subtotal_kobo: number
  }>
  created_at: string
  updated_at: string
}

export interface AvailableRider {
  id: string
  user_id: string
  zone_id: string | null
  online: boolean
  vehicle_type: string | null
  lat: number | null
  lng: number | null
}

export interface AssignRiderResponse {
  order_id: string
  rider_id: string
  message: string
}
