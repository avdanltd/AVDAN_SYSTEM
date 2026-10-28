import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { riderService } from '../services/rider.service'

const WALLET_KEYS = ['rider-wallet', 'rider-wallet-entries', 'rider-wallet-requests'] as const

export function useWallet() {
  const summary = useQuery({ queryKey: ['rider-wallet'], queryFn: () => riderService.getWallet() })
  const entries = useQuery({
    queryKey: ['rider-wallet-entries'],
    queryFn: () => riderService.getWalletEntries(),
  })
  const requests = useQuery({
    queryKey: ['rider-wallet-requests'],
    queryFn: () => riderService.getPayoutRequests(),
  })
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
    mutationFn: (amountKobo: number) => riderService.requestWithdrawal(amountKobo),
    onSuccess: () => {
      WALLET_KEYS.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }))
      toast.success('Withdrawal requested — an admin will review it shortly.')
    },
  })
}
