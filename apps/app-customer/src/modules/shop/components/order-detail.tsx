import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Bike, CheckCircle2, CreditCard, MapPin, Navigation, Package, Phone, Receipt } from 'lucide-react-native'
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

import { statusLabel } from '@/constants/status'
import { useOrder } from '../hooks/use-shop'
import { useCheckout } from '../hooks/use-checkout'
import { useOrderTracking } from '../hooks/use-order-tracking'

/** Statuses where a rider is actually en route and worth opening a live WS connection for. */
const TRACKABLE_STATUSES = new Set([
  'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT_TO_HUB', 'AT_HUB',
  'QA_IN_PROGRESS', 'QA_PASSED', 'QA_FAILED', 'VENDOR_REMEDIATION', 'OUT_FOR_DELIVERY',
])

function formatEta(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

/** The buyer-visible lifecycle, collapsed to what a customer actually cares about. */
const JOURNEY = [
  { key: 'PAID', label: 'Order placed' },
  { key: 'PREPARING', label: 'Being prepared' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
] as const

function journeyIndex(status: string): number {
  if (status === 'PENDING') return -1
  if (status === 'PAID') return 0
  if (['VENDOR_ACCEPTED', 'PREPARING'].includes(status)) return 1
  if (
    [
      'READY_FOR_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT_TO_HUB',
      'AT_HUB',
      'QA_IN_PROGRESS',
      'QA_PASSED',
      'QA_FAILED',
      'VENDOR_REMEDIATION',
      'OUT_FOR_DELIVERY',
    ].includes(status)
  )
    return 2
  if (['DELIVERED', 'PAYMENT_RELEASE_PENDING', 'PAYMENT_RELEASED', 'COMPLETED'].includes(status))
    return 3
  return -1
}

function Journey({ status }: { status: string }) {
  const { colors } = useTheme()
  const current = journeyIndex(status)
  const halted = ['VENDOR_REJECTED', 'CANCELLED', 'FAILED_DELIVERY'].includes(status)

  if (halted) {
    return (
      <View style={[styles.halted, { backgroundColor: colors.destructiveMuted }]}>
        <Text style={[styles.haltedText, { color: colors.destructive }]}>
          This order will not continue — {statusLabel(status).toLowerCase()}.
        </Text>
      </View>
    )
  }

  if (current < 0) {
    return (
      <Text style={[styles.pendingNote, { color: colors.mutedForeground }]}>
        Waiting for payment to confirm before this order starts moving.
      </Text>
    )
  }

  return (
    <View>
      {JOURNEY.map((step, i) => {
        const done = i <= current
        const isCurrent = i === current
        return (
          <View key={step.key} style={styles.journeyRow}>
            <View style={styles.journeyRail}>
              <View
                style={[styles.journeyDot, { backgroundColor: done ? colors.primary : colors.border }]}
              >
                {done ? <CheckCircle2 size={11} color={colors.primaryForeground} /> : null}
              </View>
              {i < JOURNEY.length - 1 ? (
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
              {step.label}
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
  const { data: order, isLoading, isError } = useOrder(orderId)
  const { payExistingOrder, isBusy } = useCheckout()
  const tracking = useOrderTracking(orderId, !!order && TRACKABLE_STATUSES.has(order.status))

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.skeletonCard}>
          <Skeleton height={24} width="50%" />
          <Skeleton height={16} width="80%" />
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
          action={<Button label="Go back" variant="outline" onPress={() => router.back()} fullWidth={false} />}
        />
      </View>
    )
  }

  const address = [order.delivery_address.street, order.delivery_address.city, order.delivery_address.state]
    .filter(Boolean)
    .join(', ')

  const handlePay = async () => {
    const outcome = await payExistingOrder(order.id)
    if (outcome?.paid) router.replace(`/orders/${order.id}`)
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryHeadings}>
            <Text style={[styles.ref, { color: colors.mutedForeground }]}>{orderRef(order.id)}</Text>
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatKobo(order.total_kobo)}
            </Text>
          </View>
          <Badge label={statusLabel(order.status)} bg={colors.primaryMuted} fg={colors.primary} />
        </View>
        <Text style={[styles.updated, { color: colors.subtleForeground }]}>
          Placed {formatDateTime(order.created_at)}
        </Text>
      </Card>

      {order.status === 'PENDING' ? (
        <Card style={[styles.payCard, { backgroundColor: colors.warningMuted }]}>
          <Text style={[styles.payTitle, { color: colors.foreground }]}>Payment not completed</Text>
          <Text style={[styles.payBody, { color: colors.mutedForeground }]}>
            This order is saved but not paid for yet. Complete payment to send it to the seller.
          </Text>
          <Button
            label="Pay now"
            onPress={handlePay}
            loading={isBusy}
            icon={<CreditCard size={16} color={colors.primaryForeground} />}
          />
        </Card>
      ) : null}

      <Card style={styles.block}>
        <View style={styles.blockHead}>
          <CheckCircle2 size={16} color={colors.primary} />
          <Text style={[styles.blockTitle, { color: colors.foreground }]}>Progress</Text>
        </View>
        <Journey status={order.status} />
      </Card>

      {tracking.rider && (
        <Card style={styles.block}>
          <View style={styles.blockHead}>
            <Bike size={16} color={colors.primary} />
            <Text style={[styles.blockTitle, { color: colors.foreground }]}>Your rider</Text>
            {tracking.connected && (
              <View style={[styles.liveDot, { backgroundColor: colors.successMuted }]}>
                <View style={[styles.liveDotInner, { backgroundColor: colors.success }]} />
                <Text style={[styles.liveText, { color: colors.success }]}>Live</Text>
              </View>
            )}
          </View>
          <View style={styles.riderRow}>
            <View style={styles.riderInfo}>
              <Text style={[styles.riderName, { color: colors.foreground }]}>
                {tracking.rider.name ?? 'Assigned rider'}
              </Text>
              {tracking.etaSeconds != null && (
                <Text style={[styles.riderEta, { color: colors.mutedForeground }]}>
                  Arriving in ~{formatEta(tracking.etaSeconds)}
                </Text>
              )}
            </View>
            {tracking.rider.phone && (
              <Button
                label="Call"
                variant="outline"
                size="sm"
                fullWidth={false}
                icon={<Phone size={14} color={colors.foreground} />}
                onPress={() => Linking.openURL(`tel:${tracking.rider!.phone}`)}
              />
            )}
          </View>
          {tracking.location && (
            <Button
              label="View rider location"
              variant="outline"
              icon={<Navigation size={16} color={colors.foreground} />}
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${tracking.location!.lat},${tracking.location!.lng}`,
                )
              }
            />
          )}
        </Card>
      )}

      {address ? (
        <Card style={styles.block}>
          <View style={styles.blockHead}>
            <MapPin size={16} color={colors.primary} />
            <Text style={[styles.blockTitle, { color: colors.foreground }]}>Delivering to</Text>
          </View>
          <Text style={[styles.addressText, { color: colors.foreground }]}>{address}</Text>
        </Card>
      ) : null}

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
              i < order.items.length - 1 && {
                borderBottomColor: colors.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
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
              <Text style={[styles.qtyText, { color: colors.mutedForeground }]}>
                {item.quantity}×
              </Text>
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
  payCard: { gap: spacing.md },
  payTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  payBody: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  block: { gap: spacing.md },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
  addressText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  liveDotInner: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontFamily: fonts.sansSemiBold, fontSize: 11 },
  riderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  riderInfo: { gap: 2 },
  riderName: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  riderEta: { fontFamily: fonts.sans, fontSize: 13 },
  pendingNote: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  journeyRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  journeyRail: { alignItems: 'center', width: 18 },
  journeyDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  journeyLine: { width: 2, height: 22 },
  journeyLabel: { fontSize: 14, lineHeight: 18, paddingBottom: 22, flex: 1 },
  halted: { padding: spacing.md, borderRadius: radius.md },
  haltedText: { fontFamily: fonts.sansMedium, fontSize: 13.5, lineHeight: 19 },
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
})
