import { useQuery } from '@tanstack/react-query'
import { vendorsService } from '../services/vendors.service'

export function useVendorProfile(id: string) {
  return useQuery({
    queryKey: ['admin-vendor-profile', id],
    queryFn: () => vendorsService.getProfile(id),
  })
}
