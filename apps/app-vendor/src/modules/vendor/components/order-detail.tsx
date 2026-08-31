import { useState } from 'react'
import { Image, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CheckCircle2, MapPin, Package, Receipt } from 'lucide-react-native'

import { statusLabel } from '@/constants/status'
import { useOrderActions, useVendorOrder } from '../hooks/use-vendor'
import { ORDER_ACTIONS } from '../types'
import { Badge, Button, Card, EmptyState, Skeleton, fonts, formatDateTime, formatKobo, orderRef, radius, spacing, useTheme } from '@avdan/mobile'

/** The fulfilment stages a vendor is accountable for, plus what happens after they hand off. */
const VENDOR_JOURNEY = [
  { key: 'PAID', label: 'Order paid' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
  { key: 'HANDOFF', label: 'Collected by rider' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'PAID_OUT', label: 'Paid out' },
] as const

function journeyIndex(status: string): number {
  if (status === 'PAID') return 0
  if (status === 'VENDOR_ACCEPTED' || status === 'PREPARING') return 1
  if (status === 'READY_FOR_PICKUP') return 2
  if (['PICKED_UP', 'IN_TRANSIT_TO_HUB', 'AT_HUB', 'QA_IN_PROGRESS', 'QA_PASSED', 'QA_FAILED', 'OUT_FOR_DELIVERY'].includes(status)) return 3
  if (status === 'DELIVERED' || status === 'PAYMENT_RELEASE_PENDING') return 4
  if (status === 'PAYMENT_RELEASED' || status === 'COMPLETED') return 5
  return -1
}

function Journey({ status }: { status: string }) {
  const { colors } = useTheme()
  const current = journeyIndex(status)
  const halted = ['VENDOR_REJECTED', 'REFUND_INITIATED', 'FAILED_DELIVERY', 'CANCELLED'].includes(status)

  if (halted) {
    return (
      <View style={[styles.halted, { backgroundColor: colors.destructiveMuted }]}>
        <Text style={[styles.haltedText, { color: colors.destructive }]}>
          This order stopped at {statusLabel(status).toLowerCase()} and will not continue.
        </Text>
      </View>
    )
  }

  return (
    <View>
      {VENDOR_JOURNEY.map((step, i) => {
        const done = current >= 0 && i <= current
        const isCurrent = i === current
        return (
          <View key={step.key} style={styles.journeyRow}>
            <View style={styles.journeyRail}>
              <View
                style={[
                  styles.journeyDot,
                  { backgroundColor: done ? colors.primary : colors.border },
                ]}
              >
                {done ? <CheckCircle2 size={11} color={colors.primaryForeground} /> : null}
              </View>
              {i < VENDOR_JOURNEY.length - 1 ? (
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
                  color: isCurrent
                    ? colors.foreground
                    : done
                      ? colors.mutedForeground
                      : colors.subtleForeground,
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
  const { data: order, isLoading, isError } = useVendorOrder(orderId)
  const { accept, reject, markReady, isPending } = useOrderActions(orderId)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.skeletonCard}>
          <Skeleton height={24} width="50%" />
          <Skeleton height={16} width="80%" />
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
          description="This order may not belong to your store."
          action={
            <Button label="Go back" variant="outline" onPress={() => router.back()} fullWidth={false} />
          }
        />
      </View>
    )
  }

  const actions = ORDER_ACTIONS[order.status] ?? []
  const address = [order.delivery_address.street, order.delivery_address.city, order.delivery_address.state]
    .filter(Boolean)
    .join(', ')

  const submitReject = () => {
    const trimmed = reason.trim()
    if (trimmed.length < 5) {
      setReasonError('Give the customer a reason of at least 5 characters.')
      return
    }
    setReasonError(null)
    setRejectOpen(false)
    reject.mutate(trimmed)
    setReason('')
  }

  return (
    <>
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

        <Card style={styles.block}>
          <View style={styles.blockHead}>
            <Receipt size={16} color={colors.primary} />
            <Text style={[styles.blockTitle, { color: colors.foreground }]}>
              Items to prepare ({order.items.length})
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

        {address ? (
          <Card style={styles.block}>
            <View style={styles.blockHead}>
              <MapPin size={16} color={colors.primary} />
              <Text style={[styles.blockTitle, { color: colors.foreground }]}>Delivering to</Text>
            </View>
            <Text style={[styles.addressText, { color: colors.foreground }]}>{address}</Text>
            <Text style={[styles.addressHint, { color: colors.subtleForeground }]}>
              A rider collects from your store — you do not deliver this yourself.
            </Text>
          </Card>
        ) : null}

        <Card style={styles.block}>
          <View style={styles.blockHead}>
            <CheckCircle2 size={16} color={colors.primary} />
            <Text style={[styles.blockTitle, { color: colors.foreground }]}>Progress</Text>
          </View>
          <Journey status={order.status} />
        </Card>

        {actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map((a) => (
              <Button
                key={a.action}
                label={a.label}
                variant={a.variant}
                size="lg"
                loading={isPending}
                onPress={() => {
                  if (a.action === 'accept') accept.mutate()
                  else if (a.action === 'ready') markReady.mutate()
                  else setRejectOpen(true)
                }}
              />
            ))}
          </View>
        ) : (
          <Card>
            <Text style={[styles.noActions, { color: colors.mutedForeground }]}>
              Nothing to do here — this order has moved past your part of the handoff.
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Rejection needs a written reason: the backend refunds the customer automatically and
          the reason is what they are shown. */}
      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Reject this order?</Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              The customer is refunded automatically and will see your reason. This cannot be undone.
            </Text>
            <TextInput
              style={[
                styles.reasonInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.backgroundElevated,
                  borderColor: reasonError ? colors.destructive : colors.border,
                },
              ]}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Out of stock until Friday"
              placeholderTextColor={colors.subtleForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            {reasonError ? (
              <Text style={[styles.reasonError, { color: colors.destructive }]}>{reasonError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => {
                  setRejectOpen(false)
                  setReasonError(null)
                }}
                style={styles.flex1}
              />
              <Button
                label="Reject"
                variant="destructive"
                onPress={submitReject}
                style={styles.flex1}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  skeletonCard: { gap: spacing.md },
  summary: { gap: spacing.sm },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryHeadings: { gap: 2, flex: 1 },
  ref: { fontFamily: fonts.sansMedium, fontSize: 12.5, letterSpacing: 0.4 },
  amount: { fontFamily: fonts.display, fontSize: 27 },
  updated: { fontFamily: fonts.sans, fontSize: 12 },
  block: { gap: spacing.md },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
  addressText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  addressHint: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  itemThumb: { width: 40, height: 40, borderRadius: radius.sm, borderWidth: 1 },
  itemThumbEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  qty: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    minWidth: 34,
    alignItems: 'center',
  },
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
  journeyRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  journeyRail: { alignItems: 'center', width: 18 },
  journeyDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  journeyLine: { width: 2, height: 22 },
  journeyLabel: { fontSize: 14, lineHeight: 18, paddingBottom: 22, flex: 1 },
  halted: { padding: spacing.md, borderRadius: radius.md },
  haltedText: { fontFamily: fonts.sansMedium, fontSize: 13.5, lineHeight: 19 },
  actions: { gap: spacing.md, marginTop: spacing.xs },
  noActions: { fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  modalCard: { gap: spacing.md },
  modalTitle: { fontFamily: fonts.display, fontSize: 20 },
  modalBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  reasonInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 14.5,
    minHeight: 84,
  },
  reasonError: { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  flex1: { flex: 1 },
})
