import { useQuery } from '@tanstack/react-query'

import { shopService, type ProductQuery } from '../services/shop.service'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => shopService.getCategories(),
    staleTime: 10 * 60_000,
  })
}

export function useProducts(query: ProductQuery = {}) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: () => shopService.getProducts(query),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => shopService.getProduct(id),
    enabled: !!id,
  })
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: () => shopService.getVendors(),
    staleTime: 5 * 60_000,
  })
}

export function useVendor(slug: string) {
  return useQuery({
    queryKey: ['vendor', slug],
    queryFn: () => shopService.getVendor(slug),
    enabled: !!slug,
  })
}

/** Debounce is the caller's job — pass an already-settled term. */
export function useSearch(term: string, type: 'all' | 'products' | 'vendors' = 'all') {
  return useQuery({
    queryKey: ['search', term, type],
    queryFn: () => shopService.search(term, type),
    enabled: term.trim().length >= 2,
  })
}

export function useOrders() {
  return useQuery({
    queryKey: ['customer-orders'],
    queryFn: () => shopService.getOrders(),
    refetchInterval: 30_000,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['customer-order', id],
    queryFn: () => shopService.getOrder(id),
    enabled: !!id,
    // An order in flight changes without the customer doing anything.
    refetchInterval: 20_000,
  })
}
