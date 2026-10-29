import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { productsService } from '../services/products.service'

export function useReviewProduct() {
  const queryClient = useQueryClient()
  const onSettled = () => queryClient.invalidateQueries({ queryKey: ['admin-products'] })

  const approve = useMutation({
    mutationFn: ({ id, priceKobo }: { id: string; priceKobo: number }) =>
      productsService.approve(id, priceKobo),
    onSuccess: () => toast.success('Product approved and live at the price you set.'),
    onError: (err: Error) => toast.error(err.message ?? 'Failed to approve product.'),
    onSettled,
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => productsService.reject(id, reason),
    onSuccess: () => toast.success('Product rejected. The vendor can see your reason.'),
    onError: (err: Error) => toast.error(err.message ?? 'Failed to reject product.'),
    onSettled,
  })

  return { approve, reject }
}
