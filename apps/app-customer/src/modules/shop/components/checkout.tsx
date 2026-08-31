import { useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { CreditCard, MapPin, ShieldCheck, Store } from 'lucide-react-native'
import { z } from 'zod'
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

import { useCheckout } from '../hooks/use-checkout'
import { groupByVendor, useCartStore } from '../store/cart.store'

// Mirrors DeliveryAddress on the API.
const addressSchema = z.object({
  street: z.string().trim().min(4, 'Enter the street address'),
  city: z.string().trim().min(2, 'Enter the city'),
  state: z.string().trim().min(2, 'Enter the state'),
  notes: z.string().trim().max(300, 'Notes are too long').optional(),
})

export function Checkout() {
  const { colors } = useTheme()
  const router = useRouter()
  const lines = useCartStore((s) => s.lines)
  const { checkout, stage, isBusy } = useCheckout()

  const groups = useMemo(() => groupByVendor(lines), [lines])

  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [notes, setNotes] = useState('')
  const [focused, setFocused] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (groups.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="Nothing to check out"
          description="Your cart is empty."
          action={<Button label="Browse products" onPress={() => router.push('/')} fullWidth={false} />}
        />
      </View>
    )
  }

  // One vendor at a time. The API takes a single vendor_id per order, so the button pays for
  // the first group and returns here with the rest still in the cart.
  const current = groups[0]
  const remaining = groups.length - 1

  const handlePay = async () => {
    const parsed = addressSchema.safeParse({ street, city, state, notes: notes || undefined })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})

    const outcome = await checkout(current, {
      street: parsed.data.street,
      city: parsed.data.city,
      state: parsed.data.state,
      country: 'Nigeria',
      notes: parsed.data.notes ?? null,
    })

    if (outcome) {
      router.replace(`/orders/${outcome.orderId}`)
    }
  }

  const field = (key: string) => [
    styles.inputWrap,
    {
      backgroundColor: colors.card,
      borderColor: errors[key] ? colors.destructive : focused === key ? colors.primary : colors.border,
      borderWidth: focused === key || errors[key] ? 1.6 : 1,
    },
  ]

  const label =
    stage === 'creating'
      ? 'Creating order…'
      : stage === 'paying'
        ? 'Waiting for payment…'
        : stage === 'verifying'
          ? 'Confirming payment…'
          : `Pay ${formatKobo(current.subtotalKobo)}`

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* What is being paid for now */}
        <Card style={styles.summary}>
          <View style={styles.summaryHead}>
            <View style={[styles.storeIcon, { backgroundColor: colors.primaryMuted }]}>
              <Store size={15} color={colors.primary} />
            </View>
            <Text style={[styles.storeName, { color: colors.foreground }]} numberOfLines={1}>
              {current.vendorName}
            </Text>
          </View>

          {current.lines.map((l) => (
            <View key={l.productId} style={styles.sumLine}>
              <Text style={[styles.sumQty, { color: colors.mutedForeground }]}>{l.quantity}×</Text>
              <Text style={[styles.sumName, { color: colors.foreground }]} numberOfLines={1}>
                {l.name}
              </Text>
              <Text style={[styles.sumPrice, { color: colors.mutedForeground }]}>
                {formatKobo(l.priceKobo * l.quantity)}
              </Text>
            </View>
          ))}

          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.foreground }]}>
              {formatKobo(current.subtotalKobo)}
            </Text>
          </View>

          {remaining > 0 ? (
            <Text style={[styles.remaining, { color: colors.warning }]}>
              {remaining} other {remaining === 1 ? 'seller' : 'sellers'} in your cart will be paid
              for separately after this.
            </Text>
          ) : null}
        </Card>

        {/* Delivery */}
        <Card style={styles.block}>
          <View style={styles.blockHead}>
            <MapPin size={16} color={colors.primary} />
            <Text style={[styles.blockTitle, { color: colors.foreground }]}>Delivery address</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Street address</Text>
            <View style={field('street')}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={street}
                onChangeText={setStreet}
                onFocus={() => setFocused('street')}
                onBlur={() => setFocused(null)}
                placeholder="12 Adeola Odeku Street"
                placeholderTextColor={colors.subtleForeground}
              />
            </View>
            {errors.street ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{errors.street}</Text>
            ) : null}
          </View>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
              <View style={field('city')}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={city}
                  onChangeText={setCity}
                  onFocus={() => setFocused('city')}
                  onBlur={() => setFocused(null)}
                  placeholder="Victoria Island"
                  placeholderTextColor={colors.subtleForeground}
                />
              </View>
              {errors.city ? (
                <Text style={[styles.error, { color: colors.destructive }]}>{errors.city}</Text>
              ) : null}
            </View>
            <View style={styles.flex1}>
              <Text style={[styles.label, { color: colors.foreground }]}>State</Text>
              <View style={field('state')}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={state}
                  onChangeText={setState}
                  onFocus={() => setFocused('state')}
                  onBlur={() => setFocused(null)}
                  placeholder="Lagos"
                  placeholderTextColor={colors.subtleForeground}
                />
              </View>
              {errors.state ? (
                <Text style={[styles.error, { color: colors.destructive }]}>{errors.state}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Delivery notes (optional)
            </Text>
            <View style={[...field('notes'), styles.textareaWrap]}>
              <TextInput
                style={[styles.input, styles.textarea, { color: colors.foreground }]}
                value={notes}
                onChangeText={setNotes}
                onFocus={() => setFocused('notes')}
                onBlur={() => setFocused(null)}
                placeholder="Gate code, landmark, who to call…"
                placeholderTextColor={colors.subtleForeground}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        </Card>

        {/* Escrow reassurance — this is the product's actual promise */}
        <Card style={[styles.escrow, { backgroundColor: colors.successMuted }]}>
          <ShieldCheck size={18} color={colors.success} />
          <Text style={[styles.escrowText, { color: colors.mutedForeground }]}>
            Your payment is held safely by AVDAN and only released to the seller after your order
            is delivered and checked.
          </Text>
        </Card>

        <Button
          label={label}
          onPress={handlePay}
          loading={isBusy}
          size="lg"
          icon={<CreditCard size={17} color={colors.primaryForeground} />}
        />

        <Text style={[styles.footnote, { color: colors.subtleForeground }]}>
          Payment opens in your device's secure browser. Card details are handled by Paystack and
          never seen by AVDAN.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  summary: { gap: spacing.sm },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  storeIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 15 },
  sumLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sumQty: { fontFamily: fonts.sansSemiBold, fontSize: 13, minWidth: 26 },
  sumName: { flex: 1, fontFamily: fonts.sans, fontSize: 14 },
  sumPrice: { fontFamily: fonts.sansMedium, fontSize: 13.5 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontFamily: fonts.sansMedium, fontSize: 13.5 },
  totalValue: { fontFamily: fonts.display, fontSize: 20 },
  remaining: { fontFamily: fonts.sansMedium, fontSize: 12.5, lineHeight: 18 },
  block: { gap: spacing.md },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
  fieldGroup: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13, marginBottom: spacing.sm },
  inputWrap: { borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 50, justifyContent: 'center' },
  textareaWrap: { minHeight: 84, paddingVertical: spacing.sm },
  input: { fontFamily: fonts.sans, fontSize: 15, paddingVertical: spacing.md },
  textarea: { minHeight: 68 },
  error: { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  escrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  escrowText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, lineHeight: 19 },
  footnote: { fontFamily: fonts.sans, fontSize: 12, textAlign: 'center', lineHeight: 17 },
})
