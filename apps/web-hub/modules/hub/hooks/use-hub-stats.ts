import { useQuery } from '@tanstack/react-query'
import { hubService } from '../services/hub.service'

export function useHubStats() {
  return useQuery({
    queryKey: ['hub-stats'],
    queryFn: hubService.getStats,
    refetchInterval: 30_000,
  })
}
