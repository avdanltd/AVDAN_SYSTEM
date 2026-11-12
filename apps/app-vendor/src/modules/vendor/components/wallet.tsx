import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { DEFAULT_WALLET_RANGE, type WalletRangeValue } from '@avdan/types'
import { WalletPanel, spacing, useTheme } from '@avdan/mobile'

import { useRequestWithdrawal, useWallet, useWalletExport } from '../hooks/use-vendor'

export function Wallet() {
  const { colors } = useTheme()
  const router = useRouter()
  const [range, setRange] = useState<WalletRangeValue>(DEFAULT_WALLET_RANGE)
  const { summary, entries, requests, refetchAll } = useWallet(range)
  const exportCsv = useWalletExport(range)
  const withdraw = useRequestWithdrawal()
  const [refreshing, setRefreshing] = useState(false)

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await refetchAll()
            setRefreshing(false)
          }}
          tintColor={colors.primary}
        />
      }
    >
      <WalletPanel
        summary={summary.data}
        entries={entries.data?.items ?? []}
        requests={requests.data?.items ?? []}
        loading={summary.isLoading}
        error={summary.isError}
        onRetry={() => void refetchAll()}
        showClearing
        onRequestWithdrawal={async (amountKobo) => {
          await withdraw.mutateAsync(amountKobo)
        }}
        submitting={withdraw.isPending}
        onSetupAccount={() => router.push('/profile/payout')}
        range={range}
        onRangeChange={setRange}
        onExport={() => exportCsv.mutate()}
        exporting={exportCsv.isPending}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
})
