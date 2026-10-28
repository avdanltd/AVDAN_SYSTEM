import { useMutation, useQuery } from '@tanstack/react-query'
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

export function useVerifyPayment() {
  return useMutation({
    mutationFn: (reference: string) => checkoutService.verifyPayment(reference),
  })
}

export function useDeliveryQuote(vendorId: string | null, lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['delivery-quote', vendorId, lat, lng],
    queryFn: () => checkoutService.getDeliveryQuote(vendorId as string, lat as number, lng as number),
    enabled: vendorId !== null && lat !== undefined && lng !== undefined,
    staleTime: 60_000,
  })
}
