import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast, downloadCsv } from '@avdan/ui'
import { walletCsv, walletRangeParams, type WalletRangeValue } from '@avdan/types'

import { riderService } from '../services/rider.service'

const WALLET_KEYS = ['rider-wallet', 'rider-wallet-entries', 'rider-wallet-requests'] as const

export function useWallet(range: WalletRangeValue) {
  const params = useMemo(() => walletRangeParams(range), [range])
  const summary = useQuery({
    queryKey: ['rider-wallet', params],
    queryFn: () => riderService.getWallet(params),
  })
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

export function useWalletExport(range: WalletRangeValue) {
  return useMutation({
    mutationFn: async () => {
      const { requests, entries } = await riderService.exportWallet(walletRangeParams(range))
      if (requests.length === 0 && entries.length === 0) {
        toast.error('Nothing to download for that period.')
        return
      }
      downloadCsv(`avdan-wallet-${new Date().toISOString().slice(0, 10)}`, walletCsv(requests, entries))
    },
    onError: () => toast.error('Could not prepare the download. Please try again.'),
  })
}
