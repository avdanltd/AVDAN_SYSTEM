import { useQuery } from '@tanstack/react-query'
import { productsService } from '../services/products.service'

/** Products per approval status, for one vendor or all (the numbers in the status dropdown). */
export function useProductCounts(vendorId?: string) {
  return useQuery({
    queryKey: ['admin-product-counts', vendorId ?? 'all'],
    queryFn: () => productsService.getCounts(vendorId),
    refetchInterval: 60_000,
  })
}
