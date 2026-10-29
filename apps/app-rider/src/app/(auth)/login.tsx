import { Redirect } from 'expo-router'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoginForm } from '@/modules/auth/components/login-form'
import { AvdanMark, fonts, spacing, useSession, useTheme } from '@avdan/mobile'

export default function LoginScreen() {
  const { isAuthenticated } = useSession()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  if (isAuthenticated) {
    return <Redirect href="/" />
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AvdanMark size={84} badge />
          <View style={styles.headings}>
            <Text style={[styles.title, { color: colors.foreground }]}>AVDAN Rider</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Sign in to start accepting deliveries
            </Text>
          </View>
        </View>

        <LoginForm />

        <Text style={[styles.footnote, { color: colors.subtleForeground }]}>
          Trouble signing in? Contact your dispatch coordinator.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xxl,
  },
  header: { alignItems: 'center', gap: spacing.xl },
  headings: { alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 30, fontFamily: fonts.display, letterSpacing: 0.4 },
  subtitle: { fontSize: 14.5, fontFamily: fonts.sans, textAlign: 'center', lineHeight: 21 },
  footnote: { fontSize: 12.5, fontFamily: fonts.sans, textAlign: 'center' },
})
