import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { catalogService } from '../services/catalog.service'
import type { VendorProfile } from '../types'

export function useToggleAvailability() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      catalogService.toggleAvailability(id, available),
    onMutate: async ({ id, available }) => {
      await queryClient.cancelQueries({ queryKey: ['vendor-catalog'] })
      const previous = queryClient.getQueryData<VendorProfile>(['vendor-catalog'])
      if (previous) {
        queryClient.setQueryData<VendorProfile>(['vendor-catalog'], {
          ...previous,
          products: previous.products.map((p) =>
            p.id === id ? { ...p, available } : p,
          ),
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['vendor-catalog'], context.previous)
      }
      toast.error('Failed to update availability')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-catalog'] })
    },
  })
}
