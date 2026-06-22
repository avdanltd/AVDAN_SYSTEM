import { QueryClient } from '@tanstack/react-query'

import { ApiClientError } from './api-client'

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30,
        gcTime: 1000 * 60 * 5,
        retry: (failureCount, error) => {
          if (error instanceof ApiClientError && error.status < 500) return false
          return failureCount < 2
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}
