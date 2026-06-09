import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { catalogService } from '../services/catalog.service'

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => catalogService.deleteProduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-catalog'] })
      toast.success('Product deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to delete product')
    },
  })
}
