import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/mobile'
import type { SubmitReviewsInput } from '@avdan/types'

import { shopService } from '../services/shop.service'

export function useReviews(target: 'product' | 'vendor', id: string, page: number) {
  return useQuery({
    queryKey: [`${target}-reviews`, id, page],
    queryFn: () => shopService.getReviews(target, id, page),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useOrderReviews(orderId: string) {
  return useQuery({
    queryKey: ['order-reviews', orderId],
    queryFn: () => shopService.getOrderReviews(orderId),
  })
}

export function useSubmitReviews(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: SubmitReviewsInput) => shopService.submitOrderReviews(orderId, body),
    onSuccess: (data) => {
      queryClient.setQueryData(['order-reviews', orderId], data)
      for (const key of ['product-reviews', 'vendor-reviews', 'products', 'product', 'vendors', 'vendor']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
      toast.success('Thanks for your review', 'It helps other customers.')
    },
    onError: (error: Error) => toast.error('Could not save your review', error.message),
  })
}
