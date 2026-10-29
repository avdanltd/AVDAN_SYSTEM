import { useQuery } from '@tanstack/react-query'
import { vendorsService } from '../services/vendors.service'

export function useVendor(slug: string) {
  return useQuery({
    queryKey: ['vendor', slug],
    queryFn: () => vendorsService.getVendor(slug),
    staleTime: 60_000,
    enabled: Boolean(slug),
  })
}
