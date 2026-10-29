import { useQuery } from '@tanstack/react-query'
import { vendorsService } from '../services/vendors.service'

export function useAdminVendors(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-vendors', params],
    queryFn: () => vendorsService.getVendors(params),
  })
}
