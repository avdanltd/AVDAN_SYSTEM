export interface PlatformOverview {
  active_orders: number
  riders_online: number
  revenue_today_kobo: number
  gmv_kobo: number
  orders_today: number
  pending_disputes: number
}

export interface OrderVolumePoint {
  date: string
  count: number
  revenue_kobo: number
}

export interface OrderVolumeResponse {
  data: OrderVolumePoint[]
}
