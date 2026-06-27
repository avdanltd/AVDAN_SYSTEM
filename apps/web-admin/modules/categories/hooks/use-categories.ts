import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { categoriesService } from '../services/categories.service'
import type { CategoryCreate, CategoryUpdate } from '../types'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: categoriesService.list,
    staleTime: 60_000,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CategoryCreate) => categoriesService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryUpdate }) =>
      categoriesService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeactivateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => categoriesService.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deactivated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
