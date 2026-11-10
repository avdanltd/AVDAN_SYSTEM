import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import type { SubmitReviewsInput } from '@avdan/types'

import { reviewsService, type ReviewTarget } from '../services/reviews.service'

export function useReviews(target: ReviewTarget, id: string, page: number) {
  return useQuery({
    queryKey: [`${target}-reviews`, id, page],
    queryFn: () => reviewsService.list(target, id, page),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useOrderReviews(orderId: string) {
  return useQuery({
    queryKey: ['order-reviews', orderId],
    queryFn: () => reviewsService.getForOrder(orderId),
  })
}

export function useSubmitReviews(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: SubmitReviewsInput) => reviewsService.submitForOrder(orderId, body),
    onSuccess: (data) => {
      queryClient.setQueryData(['order-reviews', orderId], data)
      // Averages shown elsewhere are now stale.
      for (const key of ['product-reviews', 'vendor-reviews', 'products', 'product', 'vendors', 'vendor']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
      toast.success('Thanks — your review helps other customers.')
    },
    onError: (error: Error) => toast.error(error.message ?? 'Could not save your review'),
  })
}
