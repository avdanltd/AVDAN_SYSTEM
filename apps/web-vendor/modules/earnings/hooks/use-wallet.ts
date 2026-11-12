import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast, downloadCsv } from '@avdan/ui'
import { walletCsv, walletRangeParams, type WalletRangeValue } from '@avdan/types'

import { earningsService } from '../services/earnings.service'

const WALLET_KEYS = ['vendor-wallet', 'vendor-wallet-entries', 'vendor-wallet-requests'] as const

export function useWallet(range: WalletRangeValue) {
  // "Last 24 hours" etc. are measured from now, so the params are fixed per preset/date change
  // (not per render) — otherwise the query key would change every render.
  const params = useMemo(() => walletRangeParams(range), [range])
  const summary = useQuery({ queryKey: ['vendor-wallet'], queryFn: earningsService.getWallet })
  const entries = useQuery({
    queryKey: ['vendor-wallet-entries', params],
    queryFn: () => earningsService.getEntries(params),
  })
  const requests = useQuery({
    queryKey: ['vendor-wallet-requests', params],
    queryFn: () => earningsService.getRequests(params),
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
    mutationFn: (amountKobo: number) => earningsService.requestWithdrawal(amountKobo),
    onSuccess: () => {
      WALLET_KEYS.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }))
      toast.success('Withdrawal requested — an admin will review it shortly.')
    },
  })
}

export function useWalletExport(range: WalletRangeValue) {
  return useMutation({
    mutationFn: async () => {
      const { requests, entries } = await earningsService.exportAll(walletRangeParams(range))
      if (requests.length === 0 && entries.length === 0) {
        toast.error('Nothing to download for that period.')
        return
      }
      downloadCsv(`avdan-wallet-${new Date().toISOString().slice(0, 10)}`, walletCsv(requests, entries))
    },
    onError: () => toast.error('Could not prepare the download. Please try again.'),
  })
}
