import { useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CheckCircle2, MapPin, Navigation, Package, Receipt } from 'lucide-react-native'

import { statusLabel } from '@/constants/status'
import { useRiderOrder } from '../hooks/use-rider-orders'
import { useOrderAction } from '../hooks/use-order-actions'
import { ORDER_ACTIONS, type RiderOrderAction } from '../types'
import { formatAddress, openInMaps } from './dashboard'
import { Badge, Button, Card, EmptyState, Skeleton, fonts, formatDateTime, formatKobo, orderRef, radius, spacing, useTheme } from '@avdan/mobile'

/** The rider-visible leg of the lifecycle, in order, for the progress trail. */
const RIDER_JOURNEY = [
  { key: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
  { key: 'PICKED_UP', label: 'Picked up' },
  { key: 'IN_TRANSIT_TO_HUB', label: 'In transit to hub' },
  { key: 'AT_HUB', label: 'At hub' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
] as const

function journeyIndex(status: string): number {
  const i = RIDER_JOURNEY.findIndex((s) => s.key === status)
  if (i >= 0) return i
  // QA states sit between AT_HUB and OUT_FOR_DELIVERY.
  if (status === 'QA_IN_PROGRESS' || status === 'QA_PASSED' || status === 'QA_FAILED') return 3
  if (status === 'FAILED_DELIVERY') return 4
  if (['COMPLETED', 'PAYMENT_RELEASED', 'PAYMENT_RELEASE_PENDING'].includes(status)) return 5
  return -1
}

function Journey({ status }: { status: string }) {
  const { colors } = useTheme()
  const current = journeyIndex(status)
  const failed = status === 'FAILED_DELIVERY'

  return (
    <View style={styles.journey}>
      {RIDER_JOURNEY.map((step, i) => {
        const done = current >= 0 && i <= current
        const isCurrent = i === current
        const dotColor = failed && i === 5 ? colors.destructive : done ? colors.primary : colors.border
        return (
          <View key={step.key} style={styles.journeyRow}>
            <View style={styles.journeyRail}>
              <View style={[styles.journeyDot, { backgroundColor: dotColor }]}>
                {done ? <CheckCircle2 size={11} color={colors.primaryForeground} /> : null}
              </View>
              {i < RIDER_JOURNEY.length - 1 ? (
                <View
                  style={[
                    styles.journeyLine,
                    { backgroundColor: current > i ? colors.primary : colors.border },
                  ]}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.journeyLabel,
                {
                  color: isCurrent ? colors.foreground : done ? colors.mutedForeground : colors.subtleForeground,
                  fontFamily: isCurrent ? fonts.sansSemiBold : fonts.sans,
                },
              ]}
            >
              {failed && i === 5 ? 'Delivery failed' : step.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter()
  const { colors } = useTheme()
  const { data: order, isLoading, isError } = useRiderOrder(orderId)
  const { execute, isPending } = useOrderAction(orderId)
  const [confirming, setConfirming] = useState<RiderOrderAction | null>(null)

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.skeletonCard}>
          <Skeleton height={24} width="50%" />
          <Skeleton height={16} width="80%" />
          <Skeleton height={16} width="65%" />
        </Card>
        <Card style={styles.skeletonCard}>
          <Skeleton height={16} width="40%" />
          <Skeleton height={16} width="70%" />
        </Card>
      </ScrollView>
    )
  }

  if (isError || !order) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<Package size={30} color={colors.subtleForeground} />}
          title="Order not found"
          description="This order may no longer be assigned to you."
          action={<Button label="Go back" variant="outline" onPress={() => router.back()} fullWidth={false} />}
        />
      </View>
    )
  }

  const actions = ORDER_ACTIONS[order.status] ?? []

  // Destructive / irreversible transitions get a confirm step — a stray tap while riding
  // should not mark a delivery failed.
  const run = (action: RiderOrderAction, label: string, destructive: boolean) => {
    if (!destructive) {
      execute(action)
      return
    }
    setConfirming(action)
    Alert.alert('Are you sure?', `${label}. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel', onPress: () => setConfirming(null) },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: () => {
          setConfirming(null)
          execute(action)
        },
      },
    ])
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Summary */}
      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryHeadings}>
            <Text style={[styles.ref, { color: colors.mutedForeground }]}>{orderRef(order.id)}</Text>
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatKobo(order.total_kobo)}
            </Text>
          </View>
          <Badge
            label={statusLabel(order.status)}
            bg={colors.primaryMuted}
            fg={colors.primary}
          />
        </View>
        <Text style={[styles.updated, { color: colors.subtleForeground }]}>
          Updated {formatDateTime(order.updated_at)}
        </Text>
      </Card>

      {/* Delivery address */}
      <Card style={styles.block}>
        <View style={styles.blockHead}>
          <MapPin size={16} color={colors.primary} />
          <Text style={[styles.blockTitle, { color: colors.foreground }]}>Delivery address</Text>
        </View>
        <Text style={[styles.addressText, { color: colors.foreground }]}>
          {formatAddress(order.delivery_address)}
        </Text>
        <Button
          label="Open in Maps"
          variant="outline"
          icon={<Navigation size={16} color={colors.foreground} />}
          onPress={() => openInMaps(order.delivery_address)}
        />
      </Card>

      {/* Progress */}
      <Card style={styles.block}>
        <View style={styles.blockHead}>
          <CheckCircle2 size={16} color={colors.primary} />
          <Text style={[styles.blockTitle, { color: colors.foreground }]}>Progress</Text>
        </View>
        <Journey status={order.status} />
      </Card>

      {/* Items */}
      <Card style={styles.block}>
        <View style={styles.blockHead}>
          <Receipt size={16} color={colors.primary} />
          <Text style={[styles.blockTitle, { color: colors.foreground }]}>
            Items ({order.items.length})
          </Text>
        </View>
        {order.items.map((item, i) => (
          <View
            key={item.id}
            style={[
              styles.itemRow,
              i < order.items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
            ]}
          >
            {item.product_image_url ? (
              <Image
                source={{ uri: item.product_image_url }}
                style={[styles.itemThumb, { borderColor: colors.border }]}
              />
            ) : (
              <View style={[styles.itemThumb, styles.itemThumbEmpty, { backgroundColor: colors.muted }]}>
                <Package size={16} color={colors.subtleForeground} />
              </View>
            )}
            <View style={[styles.qty, { backgroundColor: colors.muted }]}>
              <Text style={[styles.qtyText, { color: colors.mutedForeground }]}>{item.quantity}×</Text>
            </View>
            <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>
              {item.product_name}
            </Text>
            <Text style={[styles.itemPrice, { color: colors.mutedForeground }]}>
              {formatKobo(item.subtotal_kobo)}
            </Text>
          </View>
        ))}
        <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Order total</Text>
          <Text style={[styles.totalValue, { color: colors.foreground }]}>
            {formatKobo(order.total_kobo)}
          </Text>
        </View>
      </Card>

      {/* Actions */}
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Button
              key={a.action}
              label={a.label}
              variant={a.variant}
              size="lg"
              loading={isPending && confirming === null}
              onPress={() => run(a.action, a.label, a.variant === 'destructive')}
            />
          ))}
        </View>
      ) : (
        <Card>
          <Text style={[styles.noActions, { color: colors.mutedForeground }]}>
            No action needed from you at this stage.
          </Text>
        </Card>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  skeletonCard: { gap: spacing.md },
  summary: { gap: spacing.sm },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  summaryHeadings: { gap: 2, flex: 1 },
  ref: { fontFamily: fonts.sansMedium, fontSize: 12.5, letterSpacing: 0.4 },
  amount: { fontFamily: fonts.display, fontSize: 27 },
  updated: { fontFamily: fonts.sans, fontSize: 12 },
  block: { gap: spacing.md },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
  addressText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  journey: { gap: 0 },
  journeyRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  journeyRail: { alignItems: 'center', width: 18 },
  journeyDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  journeyLine: { width: 2, height: 22 },
  journeyLabel: { fontSize: 14, lineHeight: 18, paddingBottom: 22, flex: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  itemThumb: { width: 40, height: 40, borderRadius: radius.sm, borderWidth: 1 },
  itemThumbEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  qty: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, minWidth: 34, alignItems: 'center' },
  qtyText: { fontFamily: fonts.sansSemiBold, fontSize: 12 },
  itemName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 19 },
  itemPrice: { fontFamily: fonts.sansSemiBold, fontSize: 13.5 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontFamily: fonts.sansMedium, fontSize: 13.5 },
  totalValue: { fontFamily: fonts.display, fontSize: 18 },
  actions: { gap: spacing.md, marginTop: spacing.xs },
  noActions: { fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
