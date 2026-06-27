import { apiClient } from '@/lib/api-client'
import type { Category, CategoryCreate, CategoryUpdate } from '../types'

export const categoriesService = {
  list: () => apiClient.get<Category[]>('/categories'),
  create: (data: CategoryCreate) => apiClient.post<Category>('/categories', data),
  update: (id: string, data: CategoryUpdate) => apiClient.patch<Category>(`/categories/${id}`, data),
  deactivate: (id: string) => apiClient.delete<void>(`/categories/${id}`),
}
