import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { authService } from '../auth/services/auth.service'
import { Button } from './ui'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Forgot password" screen shared by every app. The emailed link opens the reset page on the
 *  web; once the password is changed the person signs in here again. */
export function ForgotPasswordScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: (value: string) => authService.forgotPassword(value),
    onError: (e: Error) => setError(e.message),
  })

  const submit = () => {
    const value = email.trim()
    if (!EMAIL_PATTERN.test(value)) return setError('Enter a valid email address.')
    setError(null)
    mutate(value)
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Forgot your password?</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Enter your account email and we will send you a link to choose a new password.
        </Text>

        {isSuccess ? (
          <Text style={[styles.body, { color: colors.foreground }]}>
            If an account exists for that email, a reset link is on its way. It stays valid for an hour.
            Open it, choose a new password, then come back here to sign in.
          </Text>
        ) : (
          <View style={styles.form}>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.subtleForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={submit}
              />
            </View>
            {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
            <Button label={isPending ? 'Sending…' : 'Send reset link'} onPress={submit} loading={isPending} size="lg" />
          </View>
        )}

        <Button label="Back to sign in" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
  title: { fontSize: 26, fontFamily: fonts.display },
  body: { fontSize: 14.5, fontFamily: fonts.sans, lineHeight: 21 },
  form: { gap: spacing.lg },
  inputWrap: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg, minHeight: 52, justifyContent: 'center' },
  input: { fontSize: 15, fontFamily: fonts.sans, paddingVertical: spacing.md },
  error: { fontSize: 13, fontFamily: fonts.sansMedium },
})
