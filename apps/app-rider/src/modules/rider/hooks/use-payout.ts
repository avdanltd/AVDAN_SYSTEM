import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { riderService } from '../services/rider.service'
import { toast } from '@avdan/mobile'

export function useBanks() {
  return useQuery({
    queryKey: ['banks'],
    queryFn: () => riderService.getBanks(),
    // Paystack's bank list changes rarely; refetching it on every screen visit is waste.
    staleTime: 24 * 60 * 60_000,
    // Paystack's list occasionally repeats the same `code` under more than one entry — dedupe
    // once here so nothing downstream (a FlatList key, a picker's selected-value lookup) has to
    // handle it.
    select: (banks) => {
      const seen = new Set<string>()
      return banks.filter((b) => (seen.has(b.code) ? false : (seen.add(b.code), true)))
    },
  })
}

export function usePayoutAccount() {
  return useQuery({
    queryKey: ['rider-payout-account'],
    queryFn: () => riderService.getPayoutAccount(),
  })
}

/**
 * Resolve an account number to its real account name. Deliberately a mutation, not a query:
 * it is an explicit action the rider takes, and it must not re-run on focus or retry silently.
 */
export function useVerifyAccount() {
  return useMutation({
    mutationFn: ({ accountNumber, bankCode }: { accountNumber: string; bankCode: string }) =>
      riderService.verifyAccount(accountNumber, bankCode),
    onError: (e: Error) => toast.error('Could not verify that account', e.message),
  })
}

export function useSavePayoutAccount(onDone?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: riderService.savePayoutAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rider-payout-account'] })
      qc.invalidateQueries({ queryKey: ['rider-profile'] })
      toast.success('Payout account saved', 'Your delivery fees will now reach this account.')
      onDone?.()
    },
    onError: (e: Error) => toast.error('Could not save payout account', e.message),
  })
}
