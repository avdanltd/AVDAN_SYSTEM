import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { riderService } from '../services/rider.service'

export function useBanks() {
  return useQuery({
    queryKey: ['banks'],
    queryFn: () => riderService.getBanks(),
    // Paystack's bank list changes rarely; refetching it on every screen visit is waste.
    staleTime: 24 * 60 * 60_000,
    // Paystack's list occasionally repeats the same `code` under more than one entry — dedupe
    // once here rather than at render, since a <select> with two <option>s sharing one value
    // is ambiguous to pick from, not just a React key warning.
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
    onError: (e: Error) => toast.error(e.message || 'Could not verify that account'),
  })
}

export function useSavePayoutAccount(onDone?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: riderService.savePayoutAccount,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rider-payout-account'] })
      void qc.invalidateQueries({ queryKey: ['rider-profile'] })
      toast.success('Payout account saved')
      onDone?.()
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save payout account'),
  })
}
