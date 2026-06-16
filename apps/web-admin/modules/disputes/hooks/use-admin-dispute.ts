import { useQuery } from '@tanstack/react-query'
import { disputesService } from '../services/disputes.service'

export function useAdminDispute(id: string) {
  return useQuery({
    queryKey: ['admin-dispute', id],
    queryFn: () => disputesService.getDispute(id),
    enabled: !!id,
  })
}
