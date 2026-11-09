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

export function useDeliveryQuote(
  vendorId: string | null,
  lat: number | undefined,
  lng: number | undefined,
  cart: { product_id: string; quantity: number }[],
) {
  const items = cart.map((i) => `${i.product_id}:${i.quantity}`).join(',')
  return useQuery({
    queryKey: ['delivery-quote', vendorId, lat, lng, items],
    queryFn: () => checkoutService.getDeliveryQuote(vendorId as string, lat as number, lng as number, items),
    enabled: vendorId !== null && lat !== undefined && lng !== undefined,
    staleTime: 60_000,
  })
}
