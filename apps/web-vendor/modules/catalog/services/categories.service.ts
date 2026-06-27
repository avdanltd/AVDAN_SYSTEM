import { apiClient } from '@/lib/api-client'
import type { Category } from '../types'

export const categoriesService = {
  list: () => apiClient.get<Category[]>('/categories'),
}
