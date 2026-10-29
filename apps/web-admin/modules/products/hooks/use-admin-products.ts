import { useQuery } from '@tanstack/react-query'
import { productsService } from '../services/products.service'

export function useAdminProducts(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-products', params],
    queryFn: () => productsService.getProducts(params),
  })
}
