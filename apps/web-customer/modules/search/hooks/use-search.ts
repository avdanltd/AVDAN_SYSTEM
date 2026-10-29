'use client'

import { useQuery } from '@tanstack/react-query'
import { useDeferredValue } from 'react'
import { searchService } from '../services/search.service'

export function useSearch(q: string, type: 'products' | 'vendors' | 'all' = 'all') {
  const deferredQ = useDeferredValue(q)
  return useQuery({
    queryKey: ['search', deferredQ, type],
    queryFn: () => searchService.search(deferredQ, type),
    enabled: deferredQ.trim().length >= 2,
    staleTime: 30_000,
  })
}
