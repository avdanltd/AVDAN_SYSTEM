import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { reviewsService } from '../services/reviews.service'

export function useAdminReviews(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-reviews', params],
    queryFn: () => reviewsService.list(params),
  })
}

export function useHideReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) => reviewsService.hide(v.id, v.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
      toast.success('Review hidden. It no longer counts toward ratings.')
    },
    onError: (error: Error) => toast.error(error.message ?? 'Could not hide this review'),
  })
}

export function useUnhideReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reviewsService.unhide(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
      toast.success('Review restored.')
    },
    onError: (error: Error) => toast.error(error.message ?? 'Could not restore this review'),
  })
}
