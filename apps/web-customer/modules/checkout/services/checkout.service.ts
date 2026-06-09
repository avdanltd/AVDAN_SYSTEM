import { apiClient } from '@/lib/api-client'

export interface CreateOrderPayload {
  vendor_id: string
  items: { product_id: string; quantity: number }[]
  delivery_address: {
    street: string
    city: string
    state: string
    notes?: string
  }
  contact_phone: string
}

export interface OrderCreated {
  id: string
  total_kobo: number
  status: string
}

export interface PaymentInitiated {
  payment_url: string
  reference: string
}

export const checkoutService = {
  createOrder: (payload: CreateOrderPayload) =>
    apiClient.post<OrderCreated>('/orders', payload),
  initiatePayment: (order_id: string) =>
    apiClient.post<PaymentInitiated>(`/payment/initiate/${order_id}`),
}
