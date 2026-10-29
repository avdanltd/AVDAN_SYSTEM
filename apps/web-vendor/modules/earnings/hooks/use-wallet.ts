import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { earningsService } from '../services/earnings.service'

const WALLET_KEYS = ['vendor-wallet', 'vendor-wallet-entries', 'vendor-wallet-requests'] as const

export function useWallet() {
  const summary = useQuery({ queryKey: ['vendor-wallet'], queryFn: earningsService.getWallet })
  const entries = useQuery({ queryKey: ['vendor-wallet-entries'], queryFn: earningsService.getEntries })
  const requests = useQuery({ queryKey: ['vendor-wallet-requests'], queryFn: earningsService.getRequests })
  return {
    summary,
    entries,
    requests,
    refetchAll: () => {
      void summary.refetch()
      void entries.refetch()
      void requests.refetch()
    },
  }
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (amountKobo: number) => earningsService.requestWithdrawal(amountKobo),
    onSuccess: () => {
      WALLET_KEYS.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }))
      toast.success('Withdrawal requested — an admin will review it shortly.')
    },
  })
}
