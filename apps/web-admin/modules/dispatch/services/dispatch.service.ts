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

  getAtHubOrders: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<DispatchOrder>>('/admin/orders', {
      status: 'AT_HUB,QA_IN_PROGRESS,QA_PASSED,QA_FAILED,VENDOR_REMEDIATION',
      page: String(page),
      page_size: String(pageSize),
    }),

  getOutForDeliveryOrders: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<DispatchOrder>>('/admin/orders', {
      status: 'OUT_FOR_DELIVERY',
      page: String(page),
      page_size: String(pageSize),
    }),

  getDeliveredOrders: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<DispatchOrder>>('/admin/orders', {
      status: 'DELIVERED,PAYMENT_RELEASE_PENDING',
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
