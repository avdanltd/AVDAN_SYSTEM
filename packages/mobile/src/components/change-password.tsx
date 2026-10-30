import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation } from '@tanstack/react-query'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { authService } from '../auth/services/auth.service'
import { toast } from '../lib/toast'
import { Button, Card } from './ui'

/** Change-password screen shared by every app. The route file just renders this. */
export function ChangePasswordScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: authService.changePassword,
    onSuccess: () => {
      toast.success('Password changed')
      router.back()
    },
    onError: (e: Error) => toast.error('Could not change password', e.message),
  })

  const submit = () => {
    if (!current) return setError('Enter your current password.')
    if (next.length < 8) return setError('Use at least 8 characters for the new password.')
    if (next !== confirm) return setError('The new passwords do not match.')
    setError(null)
    mutate({ current_password: current, new_password: next })
  }

  const input = (label: string, value: string, set: (v: string) => void) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          value={value}
          onChangeText={set}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  )

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          {input('Current password', current, setCurrent)}
          {input('New password', next, setNext)}
          {input('Confirm new password', confirm, setConfirm)}
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        </Card>
        <Button label={isPending ? 'Saving…' : 'Change password'} onPress={submit} loading={isPending} size="lg" />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  card: { gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 0.2 },
  inputWrap: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg, minHeight: 52, justifyContent: 'center' },
  input: { fontSize: 15, fontFamily: fonts.sans, paddingVertical: spacing.md },
  error: { fontSize: 12.5, fontFamily: fonts.sansMedium },
})
