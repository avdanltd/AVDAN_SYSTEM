import { useQuery } from '@tanstack/react-query'
import { catalogService } from '../services/catalog.service'

export function useCatalog() {
  return useQuery({
    queryKey: ['vendor-catalog'],
    queryFn: catalogService.getVendorProfile,
  })
}
