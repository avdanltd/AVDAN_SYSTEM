import { useQuery } from '@tanstack/react-query'

import { attentionService } from '../services/attention.service'

/** Refreshed every 15s so a new order reaches the vendor within seconds. */
export function useAttention() {
  return useQuery({
    queryKey: ['attention'],
    queryFn: attentionService.get,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
}
