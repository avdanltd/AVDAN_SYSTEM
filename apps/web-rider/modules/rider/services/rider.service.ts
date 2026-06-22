import { apiClient } from '@/lib/api-client'
import type { RiderProfile, RiderOrder } from '../types'

export const riderService = {
  setAvailability: (online: boolean) =>
    apiClient.post<RiderProfile>('/dispatch/me/availability', { online }),

  broadcastLocation: (lat: number, lng: number) =>
    apiClient.post<RiderProfile>('/dispatch/me/location', { lat, lng }),

  getOrders: () =>
    apiClient.get<RiderOrder[]>('/dispatch/me/orders'),

  pickupOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/pickup`),

  transitOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/transit`),

  deliverOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/deliver`),

  failOrder: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/dispatch/me/orders/${orderId}/fail`),
}
