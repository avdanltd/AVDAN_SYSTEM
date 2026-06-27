import { useQuery } from '@tanstack/react-query'
import { productsService } from '../services/products.service'

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => productsService.getProduct(id),
    staleTime: 60_000,
    enabled: !!id,
  })
}
