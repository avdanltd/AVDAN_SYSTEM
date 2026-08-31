import { useMemo } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, Inbox, Package, TrendingUp, Wallet } from 'lucide-react-native'

import { statusLabel } from '@/constants/status'
import { useVendorAnalytics, useVendorOrders, useVendorProfile } from '../hooks/use-vendor'
import { ACTIVE_STATUSES } from '../types'
import { Badge, Button, Card, EmptyState, Skeleton, fonts, formatKobo, orderRef, radius, spacing, useTheme } from '@avdan/mobile'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const router = useRouter()
  const { colors, statusColors } = useTheme()
  const { data: profile } = useVendorProfile()
  const { data: analytics } = useVendorAnalytics()
  const { data: orders, isLoading, refetch, isRefetching } = useVendorOrders()

  const all = useMemo(() => orders?.items ?? [], [orders])
  const newOrders = useMemo(() => all.filter((o) => o.status === 'PAID'), [all])
  const active = useMemo(() => all.filter((o) => ACTIVE_STATUSES.has(o.status)), [all])
  const awaitingPickup = useMemo(
    () => all.filter((o) => o.status === 'READY_FOR_PICKUP').length,
    [all],
  )

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <View style={styles.greetingBlock}>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting()},</Text>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {profile?.name ?? 'Your store'}
        </Text>
        {profile?.status && profile.status !== 'active' ? (
          <Badge
            label={statusLabel(profile.status)}
            bg={colors.warningMuted}
            fg={colors.warning}
            style={styles.storeBadge}
          />
        ) : null}
      </View>

      {/* New orders — the thing a vendor opens this app for */}
      <Card
        style={[
          styles.alertCard,
          newOrders.length > 0 && { borderColor: colors.accent, borderWidth: 1.5 },
        ]}
      >
        <View style={styles.alertHead}>
          <View
            style={[
              styles.alertIcon,
              { backgroundColor: newOrders.length ? colors.warningMuted : colors.muted },
            ]}
          >
            <Inbox size={20} color={newOrders.length ? colors.accent : colors.mutedForeground} />
          </View>
          <View style={styles.alertText}>
            <Text style={[styles.alertValue, { color: colors.foreground }]}>
              {newOrders.length}
            </Text>
            <Text style={[styles.alertLabel, { color: colors.mutedForeground }]}>
              {newOrders.length === 1 ? 'new order waiting' : 'new orders waiting'}
            </Text>
          </View>
        </View>
        {newOrders.length > 0 ? (
          <Button label="Review new orders" onPress={() => router.push('/orders')} />
        ) : (
          <Text style={[styles.alertQuiet, { color: colors.mutedForeground }]}>
            Nothing needs your attention right now.
          </Text>
        )}
      </Card>

      {/* Money + volume */}
      <View style={styles.statsRow}>
        <Card style={styles.statTile}>
          <View style={[styles.statIcon, { backgroundColor: colors.primaryMuted }]}>
            <Wallet size={16} color={colors.primary} />
          </View>
          <Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1}>
            {analytics ? formatKobo(analytics.total_revenue_kobo) : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Revenue</Text>
        </Card>
        <Card style={styles.statTile}>
          <View style={[styles.statIcon, { backgroundColor: colors.warningMuted }]}>
            <TrendingUp size={16} color={colors.accent} />
          </View>
          <Text style={[styles.statValue, { color: colors.accent }]} numberOfLines={1}>
            {analytics ? formatKobo(analytics.pending_release_kobo) : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Awaiting payout</Text>
        </Card>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statTile}>
          <Text style={[styles.miniValue, { color: colors.foreground }]}>{active.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>In progress</Text>
        </Card>
        <Card style={styles.statTile}>
          <Text style={[styles.miniValue, { color: colors.foreground }]}>{awaitingPickup}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Awaiting pickup</Text>
        </Card>
        <Card style={styles.statTile}>
          <Text style={[styles.miniValue, { color: colors.foreground }]}>
            {profile?.products?.length ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Products</Text>
        </Card>
      </View>

      {/* Needs action */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Needs your action</Text>
        {active.length > 3 ? (
          <Pressable onPress={() => router.push('/orders')} hitSlop={8}>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>See all</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <Card style={styles.skeletonCard}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={14} width="75%" />
          <Skeleton height={14} width="55%" />
        </Card>
      ) : active.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={30} color={colors.subtleForeground} />}
            title="All caught up"
            description="New orders appear here the moment a customer pays."
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {active.slice(0, 3).map((order) => {
            const tone = statusColors[order.status] ?? {
              bg: colors.muted,
              fg: colors.mutedForeground,
            }
            return (
              <Pressable
                key={order.id}
                onPress={() => router.push(`/orders/${order.id}`)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Card style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <Badge label={statusLabel(order.status)} bg={tone.bg} fg={tone.fg} />
                    <Text style={[styles.orderAmount, { color: colors.foreground }]}>
                      {formatKobo(order.total_kobo)}
                    </Text>
                  </View>
                  <View style={styles.orderFoot}>
                    <Text style={[styles.orderMeta, { color: colors.mutedForeground }]}>
                      {orderRef(order.id)} · {order.items.length}{' '}
                      {order.items.length === 1 ? 'item' : 'items'}
                    </Text>
                    <ChevronRight size={16} color={colors.subtleForeground} />
                  </View>
                </Card>
              </Pressable>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  greetingBlock: { gap: 2 },
  greeting: { fontFamily: fonts.sans, fontSize: 14 },
  name: { fontFamily: fonts.display, fontSize: 26 },
  storeBadge: { marginTop: spacing.xs },
  alertCard: { gap: spacing.lg },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  alertIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: { flex: 1 },
  alertValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  alertLabel: { fontFamily: fonts.sansMedium, fontSize: 13.5 },
  alertQuiet: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statTile: { flex: 1, gap: spacing.xs, paddingVertical: spacing.lg },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: { fontFamily: fonts.display, fontSize: 19 },
  miniValue: { fontFamily: fonts.display, fontSize: 24 },
  statLabel: { fontFamily: fonts.sansMedium, fontSize: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19 },
  sectionLink: { fontFamily: fonts.sansSemiBold, fontSize: 13 },
  skeletonCard: { gap: spacing.md },
  list: { gap: spacing.md },
  pressed: { opacity: 0.75 },
  orderCard: { gap: spacing.md },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderAmount: { fontFamily: fonts.display, fontSize: 17 },
  orderFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderMeta: { fontFamily: fonts.sans, fontSize: 12.5 },
})
