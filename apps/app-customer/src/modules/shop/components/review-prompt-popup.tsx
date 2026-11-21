import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { Star } from 'lucide-react-native'
import { Button, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { usePendingReviews } from '../hooks/use-shop'

const SNOOZE_KEY = 'avdan_review_snooze'
const SNOOZE_MS = 24 * 60 * 60 * 1000 // "Remind me later" -> ask again tomorrow

type Snoozes = Record<string, number>

async function readSnoozes(): Promise<Snoozes> {
  try {
    return JSON.parse((await SecureStore.getItemAsync(SNOOZE_KEY)) ?? '{}') as Snoozes
  } catch {
    return {}
  }
}

/**
 * Once an order is delivered (the delivery-code pop-up is gone), asks the customer to review the
 * experience. "Review now" opens the order's review form; "Remind me later" hides it for a day.
 * Once reviewed, the API stops listing the order.
 */
export function ReviewPromptPopup() {
  const { colors } = useTheme()
  const router = useRouter()
  const { data } = usePendingReviews()
  const [snoozes, setSnoozes] = useState<Snoozes | null>(null)

  useEffect(() => {
    void readSnoozes().then(setSnoozes)
  }, [])

  if (snoozes === null) return null // wait until we know what was snoozed, so nothing flashes
  const next = (data ?? []).find((p) => (snoozes[p.order_id] ?? 0) < Date.now())
  if (!next) return null

  const snooze = (orderId: string) => {
    const updated = { ...snoozes, [orderId]: Date.now() + SNOOZE_MS }
    setSnoozes(updated)
    SecureStore.setItemAsync(SNOOZE_KEY, JSON.stringify(updated)).catch(() => undefined)
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => snooze(next.order_id)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.primaryMuted }]}>
            <Star size={24} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Your order has been delivered</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Review this experience{next.vendor_name ? ` with ${next.vendor_name}` : ''}. It helps us serve you better.
          </Text>
          <Button
            label="Review now"
            onPress={() => {
              snooze(next.order_id)
              router.push(`/orders/${next.order_id}` as Href)
            }}
          />
          <Button label="Remind me later" variant="ghost" onPress={() => snooze(next.order_id)} />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl },
  card: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.xl, gap: spacing.md, alignItems: 'stretch' },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, textAlign: 'center' },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
})
