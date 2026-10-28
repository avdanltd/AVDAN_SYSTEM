import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { WalletPanel, spacing, useTheme } from '@avdan/mobile'

import { useRequestWithdrawal, useWallet } from '../hooks/use-earnings'

export function Earnings() {
  const { colors } = useTheme()
  const router = useRouter()
  const { summary, entries, requests, refetchAll } = useWallet()
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
        showClearing={false}
        onRequestWithdrawal={async (amountKobo) => {
          await withdraw.mutateAsync(amountKobo)
        }}
        submitting={withdraw.isPending}
        onSetupAccount={() => router.push('/profile/payout')}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
})
