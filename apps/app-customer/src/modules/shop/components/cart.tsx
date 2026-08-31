import { useMemo } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ImageOff, Minus, Plus, ShoppingCart, Store, Trash2 } from 'lucide-react-native'
import {
  Button,
  Card,
  EmptyState,
  fonts,
  formatKobo,
  radius,
  spacing,
  useTheme,
} from '@avdan/mobile'

import { cartTotal, groupByVendor, useCartStore } from '../store/cart.store'
import type { CartLine } from '../types'

function Line({ line }: { line: CartLine }) {
  const { colors } = useTheme()
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)
  const atMax = line.quantity >= line.stockQty

  return (
    <View style={styles.line}>
      {line.imageUrl ? (
        <Image source={{ uri: line.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.muted }]}>
          <ImageOff size={16} color={colors.subtleForeground} />
        </View>
      )}

      <View style={styles.lineBody}>
        <Text style={[styles.lineName, { color: colors.foreground }]} numberOfLines={2}>
          {line.name}
        </Text>
        <Text style={[styles.linePrice, { color: colors.foreground }]}>
          {formatKobo(line.priceKobo * line.quantity)}
        </Text>
        {atMax ? (
          <Text style={[styles.maxNote, { color: colors.warning }]}>
            Only {line.stockQty} in stock
          </Text>
        ) : null}
      </View>

      <View style={styles.lineActions}>
        <View style={[styles.stepper, { borderColor: colors.border }]}>
          <Pressable
            onPress={() => setQuantity(line.productId, line.quantity - 1)}
            hitSlop={6}
            accessibilityLabel="Decrease quantity"
            style={styles.stepBtn}
          >
            <Minus size={14} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.qty, { color: colors.foreground }]}>{line.quantity}</Text>
          <Pressable
            onPress={() => setQuantity(line.productId, line.quantity + 1)}
            hitSlop={6}
            disabled={atMax}
            accessibilityLabel="Increase quantity"
            style={styles.stepBtn}
          >
            <Plus size={14} color={atMax ? colors.subtleForeground : colors.foreground} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => remove(line.productId)}
          hitSlop={8}
          accessibilityLabel={`Remove ${line.name}`}
        >
          <Trash2 size={16} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  )
}

export function Cart() {
  const { colors } = useTheme()
  const router = useRouter()
  const lines = useCartStore((s) => s.lines)

  const groups = useMemo(() => groupByVendor(lines), [lines])
  const total = useMemo(() => cartTotal(lines), [lines])

  if (lines.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<ShoppingCart size={30} color={colors.subtleForeground} />}
          title="Your cart is empty"
          description="Browse products and add something you like."
          action={<Button label="Start shopping" onPress={() => router.push('/')} fullWidth={false} />}
        />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* One card per vendor. POST /orders takes a single vendor_id, so a basket spanning
            sellers is genuinely several orders — shown plainly rather than discovered at checkout. */}
        {groups.map((g) => (
          <Card key={g.vendorId} style={styles.group}>
            <View style={styles.groupHead}>
              <View style={[styles.storeIcon, { backgroundColor: colors.primaryMuted }]}>
                <Store size={14} color={colors.primary} />
              </View>
              <Text style={[styles.groupName, { color: colors.foreground }]} numberOfLines={1}>
                {g.vendorName}
              </Text>
            </View>

            {g.lines.map((l) => (
              <Line key={l.productId} line={l} />
            ))}

            <View style={[styles.groupFoot, { borderTopColor: colors.border }]}>
              <Text style={[styles.groupSubLabel, { color: colors.mutedForeground }]}>
                Subtotal
              </Text>
              <Text style={[styles.groupSub, { color: colors.foreground }]}>
                {formatKobo(g.subtotalKobo)}
              </Text>
            </View>
          </Card>
        ))}

        {groups.length > 1 ? (
          <Text style={[styles.splitNote, { color: colors.mutedForeground }]}>
            Items from {groups.length} sellers are checked out and paid for separately, so each one
            can be delivered on its own schedule.
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={[styles.bar, { backgroundColor: colors.background, borderTopColor: colors.border }]}
      >
        <View style={styles.barTotals}>
          <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>Total</Text>
          <Text style={[styles.barValue, { color: colors.foreground }]}>{formatKobo(total)}</Text>
        </View>
        <View style={styles.flex1}>
          <Button
            label={groups.length > 1 ? 'Checkout' : 'Checkout'}
            onPress={() => router.push('/checkout')}
            size="lg"
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  group: { gap: spacing.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  storeIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
  line: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  lineBody: { flex: 1, gap: 2 },
  lineName: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 19 },
  linePrice: { fontFamily: fonts.display, fontSize: 15 },
  maxNote: { fontFamily: fonts.sans, fontSize: 11.5 },
  lineActions: { alignItems: 'center', gap: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm },
  stepBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6 },
  qty: { fontFamily: fonts.sansSemiBold, fontSize: 13, minWidth: 20, textAlign: 'center' },
  groupFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  groupSubLabel: { fontFamily: fonts.sansMedium, fontSize: 13 },
  groupSub: { fontFamily: fonts.display, fontSize: 16 },
  splitNote: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, paddingHorizontal: spacing.xs },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barTotals: { gap: 1 },
  barLabel: { fontFamily: fonts.sans, fontSize: 12 },
  barValue: { fontFamily: fonts.display, fontSize: 20 },
})
