import { useQuery } from '@tanstack/react-query'
import { hubService } from '../services/hub.service'

export function useInboundOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['hub-inbound', params],
    queryFn: () => hubService.getInboundOrders(params),
    refetchInterval: 15_000,
  })
}
