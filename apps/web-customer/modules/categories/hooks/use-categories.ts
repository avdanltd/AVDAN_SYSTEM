import { useQuery } from '@tanstack/react-query'
import { categoriesService } from '../services/categories.service'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesService.getCategories(),
    staleTime: 5 * 60_000,
  })
}
