import { useQuery } from '@tanstack/react-query'
import { productsService } from '../services/products.service'
import type { ProductsParams } from '../types'

export function useProducts(params?: ProductsParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => productsService.getProducts(params),
    staleTime: 30_000,
  })
}
