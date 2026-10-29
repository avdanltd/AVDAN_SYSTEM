export interface PlatformOverview {
  active_orders: number
  riders_online: number
  revenue_today_kobo: number
  gmv_today_kobo: number
  orders_today: number
  pending_disputes: number
}

export interface OrderVolumePoint {
  period: string
  order_count: number
  volume_kobo: number
}

export interface OrderVolumeResponse {
  data: OrderVolumePoint[]
}
