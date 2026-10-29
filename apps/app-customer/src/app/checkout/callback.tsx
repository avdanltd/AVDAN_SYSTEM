import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { BrandLoader, fonts, spacing, useTheme } from '@avdan/mobile'

/**
 * Landing spot for the `avdancustomer://checkout/callback` deep link Paystack redirects to.
 *
 * In practice `openAuthSessionAsync` (called from `use-checkout.ts`) already resolves as soon as
 * the OS hands control back to the app, so `useCheckout` runs verify and navigates before this
 * screen would ever mount in the normal flow. This route exists as a safety net for the case
 * where the OS opens the deep link as a fresh cold start instead of resolving the open session
 * (has been observed on some Android OEM browsers) — it just closes any lingering browser tab and
 * sends the user to their orders list, where the real order state is visible either way.
 */
export default function CheckoutCallback() {
  const router = useRouter()
  const { colors } = useTheme()

  useEffect(() => {
    WebBrowser.dismissBrowser()
    const t = setTimeout(() => router.replace('/orders'), 600)
    return () => clearTimeout(t)
  }, [router])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BrandLoader />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>Finishing up…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  text: { fontFamily: fonts.sansMedium, fontSize: 14 },
})
