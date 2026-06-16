import { useMutation } from '@tanstack/react-query'
import { checkoutService, type CreateOrderPayload } from '../services/checkout.service'

export function useCreateOrder() {
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => checkoutService.createOrder(payload),
  })
}

export function useInitiatePayment() {
  return useMutation({
    mutationFn: (order_id: string) => checkoutService.initiatePayment(order_id),
  })
}
