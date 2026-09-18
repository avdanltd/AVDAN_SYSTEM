import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Wallet, X } from 'lucide-react-native'
import { Button, fonts, spacing, useTheme } from '@avdan/mobile'

import { useVendorProfile } from '../hooks/use-vendor'
import { usePayoutNudgeDismissal } from '../hooks/use-payout-nudge-dismissal'

/**
 * Post-sign-in nudge asking a vendor without a linked payout account to add one.
 *
 * Spec: STATUS_DESIGN.md §5. A dismissible banner, not a blocking `Alert.alert` — dismissing
 * never disables anything, it just snoozes the reminder for ~24h (see
 * `usePayoutNudgeDismissal`). Mounted once above the tab navigator in `(main)/_layout.tsx` so it
 * shows regardless of which tab is active, and reuses the same `useVendorProfile` query the
 * Profile and Dashboard screens already run, rather than firing a second fetch for the same field.
 */
export function PayoutNudge() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const { data: vendor } = useVendorProfile()
  const { isSnoozed, hydrated, dismiss } = usePayoutNudgeDismissal()

  if (!hydrated || !vendor || vendor.has_payout_account || isSnoozed) {
    return null
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.warningMuted,
          borderBottomColor: colors.border,
          paddingTop: insets.top + spacing.sm,
        },
      ]}
    >
      <View style={styles.row}>
        <Wallet size={18} color={colors.warning} style={styles.icon} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Add your payout account to start receiving payments
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Your earnings stay in escrow until a verified bank account is on file.
          </Text>
          <View style={styles.action}>
            <Button
              label="Set up now"
              size="sm"
              fullWidth={false}
              onPress={() => router.push('/profile/payout')}
            />
          </View>
        </View>
        <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Dismiss" style={styles.dismiss}>
          <X size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: { marginTop: 2 },
  body: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
  subtitle: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 17 },
  action: { marginTop: spacing.sm },
  dismiss: { padding: 4 },
})
