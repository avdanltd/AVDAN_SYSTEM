import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { KeyRound } from 'lucide-react-native'
import { Blink, Button, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { usePendingDeliveryCodes } from '../hooks/use-shop'

// Orders whose code has already been flashed full-screen this app session. In memory on purpose:
// a code that is still pending flashes again the next time the app opens.
const flashed = new Set<string>()

/**
 * Flashes the delivery code full-screen the moment a rider sets off, wherever the customer is in
 * the app. "Got it" shrinks it to a blinking chip above the tab bar that stays until the order is
 * delivered (the API then stops listing the code), so it is never buried under Orders.
 */
export function DeliveryCodePopup() {
  const { colors } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data } = usePendingDeliveryCodes()
  const codes = data ?? []
  const [expanded, setExpanded] = useState(false)

  const key = codes.map((c) => c.order_id).join(',')
  useEffect(() => {
    if (codes.some((c) => !flashed.has(c.order_id))) setExpanded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the code list
  }, [key])

  if (codes.length === 0) return null

  const dismiss = () => {
    codes.forEach((c) => flashed.add(c.order_id))
    setExpanded(false)
  }

  return (
    <>
      {!expanded ? (
        <View pointerEvents="box-none" style={[styles.chipWrap, { bottom: 58 + insets.bottom + spacing.md }]}>
          <Blink>
            <Pressable
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="Show your delivery code"
              style={[styles.chip, { backgroundColor: colors.primary }]}
            >
              <KeyRound size={16} color={colors.primaryForeground} />
              <Text style={[styles.chipText, { color: colors.primaryForeground }]}>
                {codes.length === 1 ? `Delivery code: ${codes[0]?.delivery_code}` : `${codes.length} delivery codes`}
              </Text>
            </Pressable>
          </Blink>
        </View>
      ) : null}

      <Modal visible={expanded} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Blink>
              <KeyRound size={28} color={colors.primary} />
            </Blink>
            <Text style={[styles.title, { color: colors.foreground }]}>Your rider is on the way</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Give the rider this code only once you have received your order.
            </Text>
            {codes.map((c) => (
              <Pressable
                key={c.order_id}
                onPress={() => {
                  dismiss()
                  router.push(`/orders/${c.order_id}`)
                }}
                style={[styles.codeBox, { backgroundColor: colors.primaryMuted }]}
              >
                {c.vendor_name ? (
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>From {c.vendor_name}</Text>
                ) : null}
                <Text style={[styles.code, { color: colors.primary }]}>{c.delivery_code}</Text>
                <Text style={[styles.link, { color: colors.primary }]}>View order</Text>
              </Pressable>
            ))}
            <Button label="Got it" onPress={dismiss} />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  chipWrap: { position: 'absolute', right: spacing.lg, left: spacing.lg, alignItems: 'flex-end' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    elevation: 6,
  },
  chipText: { fontFamily: fonts.sansBold, fontSize: 14 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  title: { fontFamily: fonts.display, fontSize: 20, textAlign: 'center' },
  body: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  codeBox: { width: '100%', borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', gap: 2 },
  code: { fontFamily: fonts.display, fontSize: 46, letterSpacing: 10 },
  link: { fontFamily: fonts.sansMedium, fontSize: 12, textDecorationLine: 'underline' },
})
