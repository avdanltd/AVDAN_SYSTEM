import { useQuery } from '@tanstack/react-query'

import { attentionService } from '../services/attention.service'

/** Refreshed every 30s so the menu badges stay current while staff work. */
export function useAttention() {
  return useQuery({
    queryKey: ['admin-attention'],
    queryFn: attentionService.get,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}
