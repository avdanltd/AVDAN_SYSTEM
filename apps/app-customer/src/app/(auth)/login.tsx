import { Redirect, useRouter } from 'expo-router'
import { StyleSheet, Text } from 'react-native'

import { LoginForm } from '@/modules/auth/components/login-form'
import { AuthSplitShell, AvdanLogo, fonts, spacing, useSession, useTheme } from '@avdan/mobile'

export default function LoginScreen() {
  const { isAuthenticated } = useSession()
  const { colors } = useTheme()
  const router = useRouter()

  if (isAuthenticated) {
    return <Redirect href="/" />
  }

  return (
    <AuthSplitShell
      imageSource={require('../../../assets/brand/auth-hero.jpg')}
      tagline="Everything you need, delivered — from trusted local vendors to your door."
      badges={[
        { value: '500+', label: 'Vendors' },
        { value: '10k+', label: 'Orders delivered' },
      ]}
      // Browsing is public on this app — login is only ever reached from an in-app prompt
      // (SignInGate, or tapping "Sign in"), never the only way in. Without this, a customer
      // who ends up here has no way back to the app they were just browsing.
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    >
      <AvdanLogo size={28} badge />
      <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Sign in to continue to your account
      </Text>

      <LoginForm />

      <Text style={[styles.footnote, { color: colors.subtleForeground }]}>
        Trouble signing in? Contact AVDAN support.
      </Text>
    </AuthSplitShell>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontFamily: fonts.display, marginTop: spacing.lg },
  subtitle: { fontSize: 14, fontFamily: fonts.sans, lineHeight: 20, marginTop: 2 },
  footnote: { fontSize: 12.5, fontFamily: fonts.sans, textAlign: 'center', marginTop: spacing.md },
})
