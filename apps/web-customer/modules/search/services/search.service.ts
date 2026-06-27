import { apiClient } from '@/lib/api-client'
import type { SearchResults } from '../types'

export const searchService = {
  search: (q: string, type: 'products' | 'vendors' | 'all' = 'all', limit = 20) =>
    apiClient.get<SearchResults>('/search', { q, type, limit: String(limit) }),
}
