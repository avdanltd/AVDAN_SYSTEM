import { useQuery } from '@tanstack/react-query'

import { hubService } from '../services/hub.service'

export function useIncoming() {
  return useQuery({
    queryKey: ['hub-incoming'],
    queryFn: () => hubService.getIncoming(),
    // Riders move; refresh often enough that the ETA is believable.
    refetchInterval: 10_000,
  })
}
