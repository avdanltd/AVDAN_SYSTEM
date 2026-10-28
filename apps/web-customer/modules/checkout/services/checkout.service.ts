import type { DeliveryQuote } from '@avdan/types'

import { apiClient } from '@/lib/api-client'

export interface CreateOrderPayload {
  vendor_id: string
  items: { product_id: string; quantity: number }[]
  delivery_address: {
    street: string
    city: string
    state: string
    notes?: string
    lat: number
    lng: number
  }
  contact_phone: string
}

export interface OrderCreated {
  id: string
  total_kobo: number
  delivery_fee_kobo: number
  status: string
}

export interface PaymentInitiated {
  payment_url: string
  reference: string
}

export interface PaymentVerified {
  paid: boolean
  order_id: string
  status: string
}

export const checkoutService = {
  getDeliveryQuote: (vendorId: string, lat: number, lng: number) =>
    apiClient.get<DeliveryQuote>('/orders/delivery-quote', {
      vendor_id: vendorId,
      lat: String(lat),
      lng: String(lng),
    }),
  createOrder: (payload: CreateOrderPayload) =>
    apiClient.post<OrderCreated>('/orders', payload),
  initiatePayment: (order_id: string) =>
    apiClient.post<PaymentInitiated>(`/payment/initiate/${order_id}`),
  verifyPayment: (reference: string) =>
    apiClient.post<PaymentVerified>(`/payment/verify/${reference}`),
}
