import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { catalogService } from '../services/catalog.service'
import type { CreateProductPayload } from '../services/catalog.service'

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProductPayload) => catalogService.createProduct(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-catalog'] })
      toast.success('Product created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to create product')
    },
  })
}
