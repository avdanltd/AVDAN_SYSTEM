import type { AdminReview, AdminReviewPage } from '@avdan/types'

import { apiClient } from '@/lib/api-client'

export const reviewsService = {
  list: (params: Record<string, string>) => apiClient.get<AdminReviewPage>('/admin/reviews', params),
  hide: (id: string, reason: string) => apiClient.post<AdminReview>(`/admin/reviews/${id}/hide`, { reason }),
  unhide: (id: string) => apiClient.post<AdminReview>(`/admin/reviews/${id}/unhide`, {}),
}
