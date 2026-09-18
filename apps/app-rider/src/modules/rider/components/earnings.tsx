import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { AlertCircle, Banknote, CheckCircle2, Clock, Wallet } from 'lucide-react-native'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  fonts,
  formatDateTime,
  formatKobo,
  orderRef,
  radius,
  spacing,
  useTheme,
} from '@avdan/mobile'

import { useEarningsSummary, usePayoutHistory } from '../hooks/use-earnings'
import type { RiderPayout } from '../types'

const STATUS_LABEL: Record<RiderPayout['status'], string> = {
  PENDING: 'Owed',
  PAYOUT_PENDING: 'Processing',
  RELEASED: 'Paid',
  FAILED: 'Failed',
}

function statusTone(status: RiderPayout['status'], colors: ReturnType<typeof useTheme>['colors']) {
  switch (status) {
    case 'RELEASED':
      return { bg: colors.successMuted, fg: colors.success }
    case 'FAILED':
      return { bg: colors.destructiveMuted, fg: colors.destructive }
    default:
      return { bg: colors.warningMuted, fg: colors.warning }
  }
}

function PayoutRow({ payout }: { payout: RiderPayout }) {
  const { colors } = useTheme()
  const tone = statusTone(payout.status, colors)
  return (
    <Card style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={[styles.rowRef, { color: colors.mutedForeground }]}>
          {orderRef(payout.order_id)}
        </Text>
        <Badge label={STATUS_LABEL[payout.status]} bg={tone.bg} fg={tone.fg} />
      </View>
      <View style={styles.rowBottom}>
        <Text style={[styles.rowAmount, { color: colors.foreground }]}>
          {formatKobo(payout.amount_kobo)}
        </Text>
        <Text style={[styles.rowDate, { color: colors.subtleForeground }]}>
          {formatDateTime(payout.created_at)}
        </Text>
      </View>
    </Card>
  )
}

export function Earnings() {
  const { colors } = useTheme()
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } =
    useEarningsSummary()
  const { data: history, isLoading: historyLoading, isError: historyError, isRefetching, refetch } =
    usePayoutHistory()

  const payouts = history?.items ?? []

  return (
    <FlatList
      data={payouts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PayoutRow payout={item} />}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            refetch()
            refetchSummary()
          }}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <>
          {summaryLoading ? (
            <View style={styles.statsRow}>
              {[0, 1, 2].map((i) => (
                <Card key={i} style={styles.statTile}>
                  <Skeleton height={22} width="70%" />
                  <Skeleton height={12} width="50%" />
                </Card>
              ))}
            </View>
          ) : summaryError ? (
            <Card style={styles.errorCard}>
              <EmptyState
                icon={<AlertCircle size={28} color={colors.subtleForeground} />}
                title="Couldn't load your earnings"
                description="Check your connection and try again."
                action={<Button label="Retry" variant="outline" onPress={() => refetchSummary()} fullWidth={false} />}
              />
            </Card>
          ) : (
            <View style={styles.statsRow}>
              <Card style={styles.statTile}>
                <View style={[styles.statIcon, { backgroundColor: colors.successMuted }]}>
                  <Wallet size={16} color={colors.success} />
                </View>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {formatKobo(summary?.total_earned_kobo ?? 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total earned</Text>
              </Card>
              <Card style={styles.statTile}>
                <View style={[styles.statIcon, { backgroundColor: colors.warningMuted }]}>
                  <Clock size={16} color={colors.warning} />
                </View>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {formatKobo(summary?.pending_kobo ?? 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Pending</Text>
              </Card>
              <Card style={styles.statTile}>
                <View style={[styles.statIcon, { backgroundColor: colors.primaryMuted }]}>
                  <CheckCircle2 size={16} color={colors.primary} />
                </View>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {summary?.deliveries_paid ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Paid deliveries</Text>
              </Card>
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payout history</Text>
        </>
      }
      ListEmptyComponent={
        historyLoading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <Card key={i} style={styles.row}>
                <Skeleton height={16} width="40%" />
                <Skeleton height={20} width="60%" />
              </Card>
            ))}
          </View>
        ) : historyError ? (
          <EmptyState
            icon={<AlertCircle size={28} color={colors.subtleForeground} />}
            title="Couldn't load payout history"
            description="Check your connection and try again."
            action={<Button label="Retry" variant="outline" onPress={() => refetch()} fullWidth={false} />}
          />
        ) : (
          <EmptyState
            icon={<Banknote size={28} color={colors.subtleForeground} />}
            title="No payouts yet"
            description="You're paid the delivery fee for each order once it's delivered."
          />
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statTile: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontFamily: fonts.display, fontSize: 16 },
  statLabel: { fontFamily: fonts.sans, fontSize: 11.5 },
  errorCard: { padding: 0 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17, marginTop: spacing.sm },
  list: { gap: spacing.md },
  row: { gap: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowRef: { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowAmount: { fontFamily: fonts.display, fontSize: 17 },
  rowDate: { fontFamily: fonts.sans, fontSize: 12 },
})
