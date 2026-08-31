import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CheckCircle2, ChevronRight, Inbox, Package } from 'lucide-react-native'

import { statusLabel } from '@/constants/status'
import { useVendorOrders } from '../hooks/use-vendor'
import { ACTIVE_STATUSES, type VendorOrder } from '../types'
import { Badge, Card, EmptyState, Skeleton, fonts, formatKobo, formatRelative, orderRef, radius, spacing, useTheme } from '@avdan/mobile'

type Tab = 'new' | 'active' | 'done'

const TABS: { key: Tab; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Completed' },
]

function OrderCard({ order, onPress }: { order: VendorOrder; onPress: () => void }) {
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

        <Text style={[styles.items, { color: colors.foreground }]} numberOfLines={2}>
          {order.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}
        </Text>

        <View style={[styles.cardFoot, { borderTopColor: colors.border }]}>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {orderRef(order.id)} · {formatRelative(order.updated_at)}
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
  const [tab, setTab] = useState<Tab>('new')
  const { data, isLoading, isRefetching, refetch } = useVendorOrders()

  const all = useMemo(() => data?.items ?? [], [data])

  const buckets = useMemo(
    () => ({
      new: all.filter((o) => o.status === 'PAID'),
      active: all.filter((o) => ACTIVE_STATUSES.has(o.status) && o.status !== 'PAID'),
      done: all.filter((o) => !ACTIVE_STATUSES.has(o.status)),
    }),
    [all],
  )

  const orders = buckets[tab]

  const empty = {
    new: {
      icon: <Inbox size={30} color={colors.subtleForeground} />,
      title: 'No new orders',
      description: 'Paid orders land here the moment a customer checks out.',
    },
    active: {
      icon: <Package size={30} color={colors.subtleForeground} />,
      title: 'Nothing in progress',
      description: 'Orders you have accepted appear here until a rider collects them.',
    },
    done: {
      icon: <CheckCircle2 size={30} color={colors.subtleForeground} />,
      title: 'No completed orders yet',
      description: 'Delivered, rejected and refunded orders are kept here.',
    },
  }[tab]

  return (
    <View style={styles.screen}>
      <View style={[styles.segment, { backgroundColor: colors.muted }]}>
        {TABS.map(({ key, label }) => {
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
                {label} ({buckets[key].length})
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
              <Skeleton height={15} width="85%" />
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
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <OrderCard order={item} onPress={() => router.push(`/orders/${item.id}`)} />
          )}
          ListEmptyComponent={
            <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
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
  items: { fontFamily: fonts.sansMedium, fontSize: 14.5, lineHeight: 20 },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  meta: { fontFamily: fonts.sans, fontSize: 12.5 },
})
