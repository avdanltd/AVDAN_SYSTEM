import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { catalogService } from '../services/catalog.service'
import type { UpdateProductPayload } from '../services/catalog.service'

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductPayload }) =>
      catalogService.updateProduct(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-catalog'] })
      toast.success('Product updated')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to update product')
    },
  })
}
