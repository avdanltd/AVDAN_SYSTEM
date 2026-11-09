import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { productsService } from '../services/products.service'

export function useAdminProducts(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-products', params],
    queryFn: () => productsService.getProducts(params),
    // Keep the list on screen while the next search is loading, so typing doesn't flash.
    placeholderData: keepPreviousData,
  })
}
