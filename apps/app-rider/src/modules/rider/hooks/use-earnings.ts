import { useMemo } from 'react'
import { Share } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/mobile'
import { walletCsv, walletRangeParams, type WalletRangeValue } from '@avdan/types'

import { riderService } from '../services/rider.service'

const WALLET_KEYS = ['rider-wallet', 'rider-wallet-entries', 'rider-wallet-requests'] as const

export function useWallet(range: WalletRangeValue) {
  const params = useMemo(() => walletRangeParams(range), [range])
  const summary = useQuery({ queryKey: ['rider-wallet'], queryFn: () => riderService.getWallet() })
  const entries = useQuery({
    queryKey: ['rider-wallet-entries', params],
    queryFn: () => riderService.getWalletEntries(params),
  })
  const requests = useQuery({
    queryKey: ['rider-wallet-requests', params],
    queryFn: () => riderService.getPayoutRequests(params),
  })
  return {
    summary,
    entries,
    requests,
    refetchAll: () => Promise.all([summary.refetch(), entries.refetch(), requests.refetch()]),
  }
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (amountKobo: number) => riderService.requestWithdrawal(amountKobo),
    onSuccess: () => {
      WALLET_KEYS.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }))
      toast.success('Withdrawal requested', 'An admin will review it shortly.')
    },
  })
}

/** Shares the filtered wallet history as CSV text (opens the system share sheet). */
export function useWalletExport(range: WalletRangeValue) {
  return useMutation({
    mutationFn: async () => {
      const { requests, entries } = await riderService.exportWallet(walletRangeParams(range))
      if (requests.length === 0 && entries.length === 0) {
        toast.error('Nothing to download', 'There is no wallet activity in that period.')
        return
      }
      await Share.share({ title: 'AVDAN wallet.csv', message: walletCsv(requests, entries) })
    },
    onError: () => toast.error('Could not prepare the file', 'Please try again.'),
  })
}
