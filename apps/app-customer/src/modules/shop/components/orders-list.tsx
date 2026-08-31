import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, Package, PackageCheck } from 'lucide-react-native'
import {
  Badge,
  Card,
  EmptyState,
  Skeleton,
  fonts,
  formatKobo,
  formatRelative,
  orderRef,
  radius,
  spacing,
  useTheme,
} from '@avdan/mobile'

import { statusLabel, OPEN_STATUSES } from '@/constants/status'
import { useOrders } from '../hooks/use-shop'
import type { CustomerOrder } from '../types'

type Tab = 'active' | 'past'

function OrderCard({ order, onPress }: { order: CustomerOrder; onPress: () => void }) {
  const { colors, statusColors } = useTheme()
  const tone = statusColors[order.status] ?? { bg: colors.muted, fg: colors.mutedForeground }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <Badge label={statusLabel(order.status)} bg={tone.bg} fg={tone.fg} />
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatKobo(order.total_kobo)}
          </Text>
        </View>
        <Text style={[styles.vendor, { color: colors.foreground }]} numberOfLines={1}>
          {order.vendor_name ?? 'Order'}
        </Text>
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

export function OrdersList() {
  const router = useRouter()
  const { colors } = useTheme()
  const [tab, setTab] = useState<Tab>('active')
  const { data, isLoading, isRefetching, refetch } = useOrders()

  const all = useMemo(() => data?.items ?? [], [data])
  const buckets = useMemo(
    () => ({
      active: all.filter((o) => OPEN_STATUSES.has(o.status)),
      past: all.filter((o) => !OPEN_STATUSES.has(o.status)),
    }),
    [all],
  )
  const orders = buckets[tab]

  return (
    <View style={styles.screen}>
      <View style={[styles.segment, { backgroundColor: colors.muted }]}>
        {(['active', 'past'] as const).map((key) => {
          const selected = tab === key
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.segmentItem,
                selected && { backgroundColor: colors.card, ...styles.segmentActive },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {key === 'active' ? 'Active' : 'Past'} ({buckets[key].length})
              </Text>
            </Pressable>
          )
        })}
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Card key={i} style={styles.card}>
              <Skeleton height={22} width="35%" />
              <Skeleton height={16} width="60%" />
              <Skeleton height={13} width="50%" />
            </Card>
          ))}
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={orders.length ? styles.list : styles.listEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <OrderCard order={item} onPress={() => router.push(`/orders/${item.id}`)} />
          )}
          ListEmptyComponent={
            tab === 'active' ? (
              <EmptyState
                icon={<Package size={30} color={colors.subtleForeground} />}
                title="No active orders"
                description="Orders you place will show up here while they are on their way."
              />
            ) : (
              <EmptyState
                icon={<PackageCheck size={30} color={colors.subtleForeground} />}
                title="No past orders yet"
                description="Delivered and cancelled orders are kept here."
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
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: { fontFamily: fonts.sansSemiBold, fontSize: 13 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.75 },
  card: { gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { fontFamily: fonts.display, fontSize: 17 },
  vendor: { fontFamily: fonts.sansMedium, fontSize: 15 },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  meta: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5 },
})
