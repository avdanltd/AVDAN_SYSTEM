import type { RiderProfile, RiderOrder } from '../types'
import { apiClient } from '@avdan/mobile'

export const riderService = {
  getProfile: () => apiClient.get<RiderProfile>('/dispatch/me'),

  setAvailability: (online: boolean) =>
    apiClient.post<RiderProfile>('/dispatch/me/availability', { online }),

  broadcastLocation: (lat: number, lng: number) =>
    apiClient.post<RiderProfile>('/dispatch/me/location', { lat, lng }),

  getOrders: () => apiClient.get<RiderOrder[]>('/dispatch/me/orders'),

  /** Terminal-state orders this rider handled, newest first. */
  getOrderHistory: (limit = 50, offset = 0) =>
    apiClient.get<RiderOrder[]>('/dispatch/me/orders/history', {
      limit: String(limit),
      offset: String(offset),
    }),

  /** One order in any status — survives the order leaving the active queue. */
  getOrder: (orderId: string) => apiClient.get<RiderOrder>(`/dispatch/me/orders/${orderId}`),

  pickupOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/pickup`),

  transitOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/transit`),

  deliverOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/deliver`),

  failOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/fail`),
}
