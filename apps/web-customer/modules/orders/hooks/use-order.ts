import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/orders.service'

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersService.getOrder(id),
    staleTime: 15_000,
    // While the parcel is on its way the delivery code appears the moment the rider sets off,
    // so keep the order fresh instead of waiting for the customer to reload.
    refetchInterval: (query) =>
      ['QA_PASSED', 'AT_HUB', 'OUT_FOR_DELIVERY'].includes(query.state.data?.status ?? '') ? 15_000 : false,
    enabled: Boolean(id),
  })
}
