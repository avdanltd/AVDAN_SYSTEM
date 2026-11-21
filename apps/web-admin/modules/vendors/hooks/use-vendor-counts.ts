import { useQuery } from '@tanstack/react-query'
import { vendorsService } from '../services/vendors.service'

/** Vendors per status plus how many have not filled all requirements (the numbers in the dropdown). */
export function useVendorCounts() {
  return useQuery({
    queryKey: ['admin-vendor-counts'],
    queryFn: vendorsService.getCounts,
    refetchInterval: 60_000,
  })
}
