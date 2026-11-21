import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { productsService } from '../services/products.service'

export function useProductVendors(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-product-vendors', params],
    queryFn: () => productsService.getVendors(params),
    placeholderData: keepPreviousData,
  })
}
