import { useQuery } from '@tanstack/react-query'
import { hubService } from '../services/hub.service'

export function useHubOrder(id: string) {
  return useQuery({
    queryKey: ['hub-order', id],
    queryFn: () => hubService.getOrder(id),
    enabled: Boolean(id),
  })
}
