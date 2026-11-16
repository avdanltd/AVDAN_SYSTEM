import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import type { SubmitReviewsInput } from '@avdan/types'

import { useSession } from '@/modules/auth/hooks/use-session'
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

/** Recently delivered orders the customer hasn't reviewed yet. Polled so the prompt appears
 *  soon after the rider confirms the delivery code. Customers only. */
export function usePendingReviews() {
  const { isAuthenticated, role } = useSession()
  return useQuery({
    queryKey: ['pending-reviews'],
    queryFn: reviewsService.getPending,
    enabled: isAuthenticated && role === 'customer',
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}
