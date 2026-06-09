import { useQuery } from '@tanstack/react-query'
import { vendorsService } from '../services/vendors.service'

export function useVendors(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['vendors', params],
    queryFn: () => vendorsService.getVendors(params),
    staleTime: 30_000,
  })
}
