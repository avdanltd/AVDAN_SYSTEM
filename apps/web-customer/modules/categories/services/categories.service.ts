import { apiClient } from '@/lib/api-client'
import type { Category } from '../types'

export const categoriesService = {
  getCategories: () => apiClient.get<Category[]>('/categories'),
}
