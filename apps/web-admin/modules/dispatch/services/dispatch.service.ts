import { apiClient } from '@/lib/api-client'
import type { AssignRiderResponse, AvailableRider, DispatchOrder } from '../types'
import type { PaginatedResponse } from '@avdan/types'

export const dispatchService = {
  getReadyOrders: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<DispatchOrder>>('/admin/orders', {
      status: 'READY_FOR_PICKUP',
      page: String(page),
      page_size: String(pageSize),
    }),

  getInTransitOrders: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<DispatchOrder>>('/admin/orders', {
      status: 'IN_TRANSIT_TO_HUB',
      page: String(page),
      page_size: String(pageSize),
    }),

  getPickedUpOrders: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<DispatchOrder>>('/admin/orders', {
      status: 'PICKED_UP',
      page: String(page),
      page_size: String(pageSize),
    }),

  getAvailableRiders: (zoneId?: string) =>
    apiClient.get<AvailableRider[]>('/dispatch/riders/available', zoneId ? { zone_id: zoneId } : {}),

  assignRider: (orderId: string, riderId?: string) =>
    apiClient.post<AssignRiderResponse>(`/dispatch/assign/${orderId}`, { rider_id: riderId ?? null }),

  getAllRiders: () =>
    apiClient.get<AvailableRider[]>('/dispatch/riders'),
}
