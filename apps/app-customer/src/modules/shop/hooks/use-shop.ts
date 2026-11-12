import { useQuery } from '@tanstack/react-query'
import { useSession } from '@avdan/mobile'

import { shopService, type LocationQuery, type ProductQuery } from '../services/shop.service'

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

export function useVendors(where: LocationQuery = {}) {
  return useQuery({
    queryKey: ['vendors', where],
    queryFn: () => shopService.getVendors(1, 20, where),
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

/**
 * Delivery codes the signed-in customer still has to give a rider. Polled so the pop-up and the
 * Orders-tab badge show up soon after the rider sets off and clear once the order is delivered.
 */
export function usePendingDeliveryCodes() {
  const { isAuthenticated } = useSession()
  return useQuery({
    queryKey: ['pending-delivery-codes'],
    queryFn: () => shopService.getPendingDeliveryCodes(),
    enabled: isAuthenticated,
    refetchInterval: 15_000,
    staleTime: 10_000,
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
