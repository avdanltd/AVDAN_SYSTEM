import { apiClient } from '@/lib/api-client'
import type { OrderReviews, ReviewPage, SubmitReviewsInput } from '@avdan/types'

export type ReviewTarget = 'product' | 'vendor'

export const reviewsService = {
  list: (target: ReviewTarget, id: string, page: number) =>
    apiClient.get<ReviewPage>(`/reviews/${target}s/${id}`, { page: String(page), page_size: '5' }),
  getForOrder: (orderId: string) => apiClient.get<OrderReviews>(`/reviews/orders/${orderId}`),
  submitForOrder: (orderId: string, body: SubmitReviewsInput) =>
    apiClient.post<OrderReviews>(`/reviews/orders/${orderId}`, body),
}
