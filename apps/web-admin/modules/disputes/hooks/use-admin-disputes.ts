import { useQuery } from '@tanstack/react-query'
import { disputesService } from '../services/disputes.service'

export function useAdminDisputes(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-disputes', params],
    queryFn: () => disputesService.getDisputes(params),
  })
}
