import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse, OrderStatus } from '@avdan/types'

export interface OrderItem {
  id: string
  product_id: string
  name: string
  price_kobo: number
  quantity: number
}

export interface OrderEvent {
  id: string
  from_state: string | null
  to_state: string
  actor_role: string | null
  created_at: string
}

export interface Order {
  id: string
  vendor_id: string
  vendor_name?: string
  status: OrderStatus
  total_kobo: number
  delivery_address: Record<string, unknown>
  contact_phone?: string
  created_at: string
  updated_at: string
  items?: OrderItem[]
  events?: OrderEvent[]
}

export const ordersService = {
  getOrders: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Order>>('/orders', params),
  getOrder: (id: string) => apiClient.get<Order>(`/orders/${id}`),
  cancelOrder: (id: string) =>
    apiClient.post<{ message: string }>(`/orders/${id}/cancel`),
}
