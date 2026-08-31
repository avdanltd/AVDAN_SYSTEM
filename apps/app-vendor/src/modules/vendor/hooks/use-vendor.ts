import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { vendorService, type CreateProductPayload } from '../services/vendor.service'
import { toast } from '@avdan/mobile'

/* ── Storefront + catalog ─────────────────────────────────────────────────── */

/** `GET /vendors/me` carries both the storefront and its product list. */
export function useVendorProfile() {
  return useQuery({
    queryKey: ['vendor-profile'],
    queryFn: () => vendorService.getProfile(),
    staleTime: 30_000,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => vendorService.getCategories(),
    staleTime: 10 * 60_000,
  })
}

export function useVendorAnalytics() {
  return useQuery({
    queryKey: ['vendor-analytics'],
    queryFn: () => vendorService.getAnalytics(),
    refetchInterval: 60_000,
  })
}

/* ── Orders ───────────────────────────────────────────────────────────────── */

export function useVendorOrders() {
  return useQuery({
    queryKey: ['vendor-orders'],
    queryFn: () => vendorService.getOrders(),
    // New paid orders are the vendor's primary alert; poll the same cadence as web-vendor.
    refetchInterval: 30_000,
  })
}

export function useVendorOrder(orderId: string) {
  return useQuery({
    queryKey: ['vendor-order', orderId],
    queryFn: () => vendorService.getOrder(orderId),
    enabled: !!orderId,
  })
}

export function useOrderActions(orderId: string) {
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['vendor-orders'] })
    qc.invalidateQueries({ queryKey: ['vendor-order', orderId] })
    qc.invalidateQueries({ queryKey: ['vendor-analytics'] })
  }

  const accept = useMutation({
    mutationFn: () => vendorService.acceptOrder(orderId),
    onSuccess: () => {
      invalidate()
      toast.success('Order accepted', 'It is now marked as preparing.')
    },
    onError: (e: Error) => toast.error('Could not accept order', e.message),
  })

  const reject = useMutation({
    mutationFn: (reason: string) => vendorService.rejectOrder(orderId, reason),
    onSuccess: () => {
      invalidate()
      toast.info('Order rejected', 'The customer will be refunded automatically.')
    },
    onError: (e: Error) => toast.error('Could not reject order', e.message),
  })

  const markReady = useMutation({
    mutationFn: () => vendorService.markReady(orderId),
    onSuccess: () => {
      invalidate()
      toast.success('Marked ready for pickup', 'Dispatch can now assign a rider.')
    },
    onError: (e: Error) => toast.error('Could not update order', e.message),
  })

  return {
    accept,
    reject,
    markReady,
    isPending: accept.isPending || reject.isPending || markReady.isPending,
  }
}

/* ── Product mutations ────────────────────────────────────────────────────── */

function useCatalogInvalidation() {
  const qc = useQueryClient()
  // Products live inside the vendor-profile payload, so that is the cache to refresh.
  return () => qc.invalidateQueries({ queryKey: ['vendor-profile'] })
}

export function useCreateProduct(onDone?: () => void) {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (payload: CreateProductPayload) => vendorService.createProduct(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Product added')
      onDone?.()
    },
    onError: (e: Error) => toast.error('Could not add product', e.message),
  })
}

export function useUpdateProduct(productId: string, onDone?: () => void) {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (payload: Partial<CreateProductPayload>) =>
      vendorService.updateProduct(productId, payload),
    onSuccess: () => {
      invalidate()
      toast.success('Product updated')
      onDone?.()
    },
    onError: (e: Error) => toast.error('Could not save product', e.message),
  })
}

export function useDeleteProduct(onDone?: () => void) {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (productId: string) => vendorService.deleteProduct(productId),
    onSuccess: () => {
      invalidate()
      toast.success('Product removed')
      onDone?.()
    },
    onError: (e: Error) => toast.error('Could not remove product', e.message),
  })
}

export function useSetAvailability() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: ({ productId, available }: { productId: string; available: boolean }) =>
      vendorService.setAvailability(productId, available),
    onSuccess: (product) => {
      invalidate()
      toast.success(product.available ? 'Product is now visible' : 'Product hidden from customers')
    },
    onError: (e: Error) => toast.error('Could not update availability', e.message),
  })
}

export function useUpdateStorefront(onDone?: () => void) {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (payload: { name?: string; description?: string | null }) =>
      vendorService.updateProfile(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Storefront updated')
      onDone?.()
    },
    onError: (e: Error) => toast.error('Could not save storefront', e.message),
  })
}

/* ── Payout ───────────────────────────────────────────────────────────────── */

export function useBanks() {
  return useQuery({
    queryKey: ['banks'],
    queryFn: () => vendorService.getBanks(),
    // Paystack's bank list changes rarely; refetching it on every screen visit is waste.
    staleTime: 24 * 60 * 60_000,
  })
}

export function usePayoutAccount() {
  return useQuery({
    queryKey: ['payout-account'],
    queryFn: () => vendorService.getPayoutAccount(),
  })
}

/**
 * Resolve an account number to its real account name. Deliberately a mutation, not a query:
 * it is an explicit action the vendor takes, and it must not re-run on focus or retry silently.
 */
export function useVerifyAccount() {
  return useMutation({
    mutationFn: ({ accountNumber, bankCode }: { accountNumber: string; bankCode: string }) =>
      vendorService.verifyAccount(accountNumber, bankCode),
    onError: (e: Error) =>
      toast.error('Could not verify that account', e.message),
  })
}

export function useSavePayoutAccount(onDone?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vendorService.savePayoutAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payout-account'] })
      // The vendor-profile payload carries has_payout_account, so the warning card clears too.
      qc.invalidateQueries({ queryKey: ['vendor-profile'] })
      toast.success('Payout account saved', 'Escrow releases will now reach this account.')
      onDone?.()
    },
    onError: (e: Error) => toast.error('Could not save payout account', e.message),
  })
}
