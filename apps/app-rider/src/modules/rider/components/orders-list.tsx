import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, History, MapPin, Package } from 'lucide-react-native'

import { statusLabel } from '@/constants/status'
import { useRiderOrders, useRiderOrderHistory } from '../hooks/use-rider-orders'
import { formatAddress } from './dashboard'
import type { RiderOrder } from '../types'
import { Badge, Button, Card, EmptyState, Skeleton, fonts, formatKobo, formatRelative, orderRef, radius, spacing, useTheme } from '@avdan/mobile'

type Tab = 'active' | 'history'

function OrderCard({ order, onPress }: { order: RiderOrder; onPress: () => void }) {
  const { colors, statusColors } = useTheme()
  const tone = statusColors[order.status] ?? { bg: colors.muted, fg: colors.mutedForeground }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <Badge label={statusLabel(order.status)} bg={tone.bg} fg={tone.fg} />
          <View style={styles.amountBlock}>
            <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>You earn</Text>
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatKobo(order.delivery_fee_kobo)}
            </Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <MapPin size={15} color={colors.subtleForeground} />
          <Text style={[styles.address, { color: colors.foreground }]} numberOfLines={2}>
            {Object.keys(order.delivery_address ?? {}).length > 0
              ? formatAddress(order.delivery_address)
              : (order.hub_name ?? 'Drop-off hub')}
          </Text>
        </View>

        <View style={[styles.cardFoot, { borderTopColor: colors.border }]}>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {orderRef(order.id)} · {order.items.length}{' '}
            {order.items.length === 1 ? 'item' : 'items'} · {formatRelative(order.updated_at)}
          </Text>
          <ChevronRight size={16} color={colors.subtleForeground} />
        </View>
      </Card>
    </Pressable>
  )
}

function LoadingList() {
  return (
    <View style={styles.list}>
      {[0, 1, 2].map((i) => (
        <Card key={i} style={styles.card}>
          <Skeleton height={22} width="38%" />
          <Skeleton height={15} width="85%" />
          <Skeleton height={13} width="55%" />
        </Card>
      ))}
    </View>
  )
}

export function OrdersList() {
  const router = useRouter()
  const { colors, shadowCard } = useTheme()
  const [tab, setTab] = useState<Tab>('active')

  const active = useRiderOrders()
  const history = useRiderOrderHistory()
  const query = tab === 'active' ? active : history
  const orders = query.data ?? []

  return (
    <View style={styles.screen}>
      {/* Segmented control */}
      <View style={[styles.segment, { backgroundColor: colors.muted }]}>
        {(['active', 'history'] as const).map((t) => {
          const selected = tab === t
          const count = t === 'active' ? active.data?.length : history.data?.length
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.segmentItem,
                selected && { backgroundColor: colors.card, ...shadowCard },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {t === 'active' ? 'Active' : 'History'}
                {typeof count === 'number' ? ` (${count})` : ''}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {query.isLoading ? (
        <LoadingList />
      ) : query.isError ? (
        <View style={styles.listEmpty}>
          <EmptyState
            icon={<Package size={30} color={colors.subtleForeground} />}
            title="Couldn't load orders"
            description="Something went wrong fetching your orders. Check your connection and try again."
            action={
              <Button label="Retry" variant="outline" onPress={() => query.refetch()} fullWidth={false} />
            }
          />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={orders.length ? styles.list : styles.listEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={query.refetch}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <OrderCard order={item} onPress={() => router.push(`/orders/${item.id}`)} />
          )}
          ListEmptyComponent={
            tab === 'active' ? (
              <EmptyState
                icon={<Package size={30} color={colors.subtleForeground} />}
                title="No active orders"
                description="Orders assigned to you will appear here. Go online from Home to start receiving them."
              />
            ) : (
              <EmptyState
                icon={<History size={30} color={colors.subtleForeground} />}
                title="No completed orders yet"
                description="Deliveries you finish will be kept here so you can look them up later."
              />
            )
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    minHeight: 40,
  },
  segmentText: { fontFamily: fonts.sansSemiBold, fontSize: 13.5 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.75 },
  card: { gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountBlock: { alignItems: 'flex-end' },
  amountLabel: { fontFamily: fonts.sans, fontSize: 11 },
  amount: { fontFamily: fonts.display, fontSize: 17 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  address: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14.5, lineHeight: 20 },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  meta: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5 },
})
