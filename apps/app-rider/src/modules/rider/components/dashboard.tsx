import { useMemo } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, MapPin, Navigation, Package, TrendingUp } from 'lucide-react-native'

import { statusLabel } from '@/constants/status'
import { useAvailability, useRiderProfile } from '../hooks/use-availability'
import { useRiderOrders, useRiderOrderHistory } from '../hooks/use-rider-orders'
import { useLocationBroadcast } from '../hooks/use-location-broadcast'
import { StatusToggle } from './status-toggle'
import { ORDER_ACTIONS, type RiderOrder } from '../types'
import { Badge, Button, Card, EmptyState, Skeleton, fonts, formatKobo, isToday, orderRef, radius, spacing, useSession, useTheme } from '@avdan/mobile'

// Every status in which the rider still holds responsibility for the order. IN_TRANSIT_TO_HUB and
// AT_HUB were missing, so the Active Delivery card vanished the moment a rider marked in-transit —
// while they were literally still carrying the package.
const ACTIVE_STATUSES = new Set([
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT_TO_HUB',
  'AT_HUB',
  'QA_PASSED',
  'OUT_FOR_DELIVERY',
])

export function formatAddress(address: RiderOrder['delivery_address']): string {
  return [address.street, address.city, address.state].filter(Boolean).join(', ') || 'Delivery address'
}

export function openInMaps(address: RiderOrder['delivery_address']) {
  const query = encodeURIComponent(formatAddress(address))
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
}

export function openCoordsInMaps(lat: number, lng: number) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
}

function firstName(name: string | null | undefined): string {
  if (!name) return 'there'
  return name.trim().split(/\s+/)[0] ?? 'there'
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const router = useRouter()
  const { colors } = useTheme()
  const { user } = useSession()

  const { data: profile } = useRiderProfile()
  const { mutate: toggleAvailability, isPending: isToggling } = useAvailability()
  const { data: orders, isLoading, refetch, isRefetching } = useRiderOrders()
  const { data: history } = useRiderOrderHistory()

  const isOnline = profile?.online ?? false
  useLocationBroadcast(isOnline)

  const activeOrders = useMemo(
    () => orders?.filter((o) => ACTIVE_STATUSES.has(o.status)) ?? [],
    [orders],
  )
  const activeOrder = activeOrders[0]

  // Counted from history, not the active list: a delivered order leaves the active queue the
  // instant it is delivered, so counting DELIVERED there always yielded zero.
  const deliveredToday = useMemo(
    () => history?.filter((o) => o.status !== 'CANCELLED' && isToday(o.updated_at)).length ?? 0,
    [history],
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
        <Text style={[styles.name, { color: colors.foreground }]}>{firstName(user?.name)}</Text>
      </View>

      {/* Availability */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHead}>
          <View
            style={[
              styles.pulseDot,
              { backgroundColor: isOnline ? colors.success : colors.subtleForeground },
            ]}
          />
          <Text style={[styles.statusEyebrow, { color: colors.mutedForeground }]}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
        <Text style={[styles.statusHeadline, { color: colors.foreground }]}>
          {isOnline ? 'Accepting deliveries' : 'Not accepting'}
        </Text>
        <View style={styles.toggleWrap}>
          <StatusToggle isOnline={isOnline} isPending={isToggling} onToggle={toggleAvailability} />
        </View>
        <Text style={[styles.statusHelp, { color: colors.mutedForeground }]}>
          {isOnline
            ? 'You are visible to dispatch and broadcasting your location.'
            : 'Go online to start receiving assignments.'}
        </Text>
      </Card>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Card style={styles.statTile}>
          <View style={[styles.statIcon, { backgroundColor: colors.primaryMuted }]}>
            <Package size={16} color={colors.primary} />
          </View>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{activeOrders.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active</Text>
        </Card>
        <Card style={styles.statTile}>
          <View style={[styles.statIcon, { backgroundColor: colors.warningMuted }]}>
            <TrendingUp size={16} color={colors.accent} />
          </View>
          <Text style={[styles.statValue, { color: colors.accent }]}>{deliveredToday}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Done today</Text>
        </Card>
      </View>

      {/* Active delivery */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Delivery</Text>
        {activeOrders.length > 1 ? (
          <Pressable onPress={() => router.push('/orders')} hitSlop={8}>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>
              +{activeOrders.length - 1} more
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <Card style={styles.skeletonCard}>
          <Skeleton height={20} width="45%" />
          <Skeleton height={14} width="80%" />
          <Skeleton height={14} width="60%" />
          <Skeleton height={44} style={styles.skeletonAction} />
        </Card>
      ) : activeOrder ? (
        <Card style={styles.activeCard}>
          <View style={styles.activeTop}>
            <Badge
              label={statusLabel(activeOrder.status)}
              bg={colors.accent}
              fg={colors.accentForeground}
            />
            <Text style={[styles.total, { color: colors.foreground }]}>
              {formatKobo(activeOrder.total_kobo)}
            </Text>
          </View>

          <View style={styles.addressRow}>
            <View style={[styles.iconChip, { backgroundColor: colors.primaryMuted }]}>
              <MapPin size={18} color={colors.primary} />
            </View>
            <View style={styles.addressBody}>
              <Text style={[styles.address, { color: colors.foreground }]} numberOfLines={2}>
                {formatAddress(activeOrder.delivery_address)}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {orderRef(activeOrder.id)} · {activeOrder.items.length}{' '}
                {activeOrder.items.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.actions}>
            <Button
              label="Navigate"
              variant="outline"
              icon={<Navigation size={16} color={colors.foreground} />}
              onPress={() => openInMaps(activeOrder.delivery_address)}
              style={styles.flex1}
            />
            <Button
              label={ORDER_ACTIONS[activeOrder.status] ? 'Take action' : 'View'}
              variant={ORDER_ACTIONS[activeOrder.status] ? 'default' : 'outline'}
              onPress={() => router.push(`/orders/${activeOrder.id}`)}
              style={styles.flex1}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<MapPin size={30} color={colors.subtleForeground} />}
            title="No active deliveries"
            description={
              isOnline
                ? 'You are online. Dispatch will assign you an order shortly.'
                : 'Go online above to start receiving assignments.'
            }
          />
        </Card>
      )}

      <Pressable
        onPress={() => router.push('/orders')}
        style={({ pressed }) => [
          styles.linkRow,
          { borderColor: colors.border, backgroundColor: colors.card },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={[styles.linkText, { color: colors.foreground }]}>View all orders</Text>
        <ChevronRight size={18} color={colors.subtleForeground} />
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  greetingBlock: { gap: 2 },
  greeting: { fontFamily: fonts.sans, fontSize: 14 },
  name: { fontFamily: fonts.display, fontSize: 26 },
  statusCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  statusEyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.6 },
  statusHeadline: { fontFamily: fonts.display, fontSize: 22 },
  toggleWrap: { width: '100%', marginTop: spacing.xs },
  statusHelp: {
    fontFamily: fonts.sans,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: spacing.md,
  },
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
  statValue: { fontFamily: fonts.display, fontSize: 26 },
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
  skeletonAction: { marginTop: spacing.sm },
  activeCard: { gap: spacing.lg },
  activeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontFamily: fonts.display, fontSize: 19 },
  addressRow: { flexDirection: 'row', gap: spacing.md },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBody: { flex: 1, gap: 3 },
  address: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: fonts.sans, fontSize: 12.5 },
  divider: { height: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex1: { flex: 1 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  linkText: { fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
})
