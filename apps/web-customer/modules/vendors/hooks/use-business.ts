import { useQuery } from '@tanstack/react-query'
import { vendorsService } from '../services/vendors.service'

export function useBusiness(slug: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: ['business', slug, params],
    queryFn: () => vendorsService.getBusiness(slug, params),
    staleTime: 60_000,
    enabled: Boolean(slug),
  })
}
