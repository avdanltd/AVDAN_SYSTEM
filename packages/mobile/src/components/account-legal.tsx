import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { authService } from '../auth/services/auth.service'
import { useAuthStore } from '../auth/store/auth.store'
import { secureStorage } from '../lib/secure-storage'
import { toast } from '../lib/toast'
import { Button, Card } from './ui'

const SITE = 'https://avdanstore.com'

/**
 * Privacy policy, terms and "delete my account" for the profile screen of every app. Both stores
 * require the legal links inside the app and an in-app way to delete the account. The server
 * refuses deletion while orders are in progress or a wallet still holds money, and says why.
 */
export function AccountLegal() {
  const { colors } = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const clearUser = useAuthStore((s) => s.clearUser)
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => authService.deleteAccount(password),
    onSuccess: async () => {
      toast.success('Account deleted', 'Your account has been removed.')
      await secureStorage.clear()
      clearUser()
      queryClient.clear()
      router.replace('/login')
    },
    onError: (e: Error) => setError(e.message),
  })

  const open = (path: string) => void Linking.openURL(`${SITE}${path}`)

  return (
    <Card style={styles.card}>
      <View style={styles.links}>
        <Pressable onPress={() => open('/privacy')} accessibilityRole="link">
          <Text style={[styles.link, { color: colors.primary }]}>Privacy policy</Text>
        </Pressable>
        <Pressable onPress={() => open('/terms')} accessibilityRole="link">
          <Text style={[styles.link, { color: colors.primary }]}>Terms of service</Text>
        </Pressable>
      </View>

      {!confirming ? (
        <Pressable onPress={() => setConfirming(true)} accessibilityRole="button">
          <Text style={[styles.danger, { color: colors.destructive }]}>Delete my account</Text>
        </Pressable>
      ) : (
        <View style={styles.confirm}>
          <Text style={[styles.title, { color: colors.destructive }]}>Delete your account?</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            This removes your name, email and phone and signs you out for good. It can’t be undone. Order and payment records are kept as the law
            requires, without your personal details. Enter your password to confirm.
          </Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={password}
            onChangeText={(t) => {
              setPassword(t)
              setError(null)
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Your password"
            placeholderTextColor={colors.subtleForeground}
          />
          {error ? <Text style={[styles.body, { color: colors.destructive }]}>{error}</Text> : null}
          <Button label="Delete permanently" variant="destructive" onPress={() => mutate()} loading={isPending} disabled={!password} />
          <Button
            label="Keep my account"
            variant="outline"
            onPress={() => {
              setConfirming(false)
              setPassword('')
              setError(null)
            }}
          />
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  links: { flexDirection: 'row', gap: spacing.lg },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 14, textDecorationLine: 'underline' },
  danger: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
  confirm: { gap: spacing.sm },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  body: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.sans, fontSize: 15, minHeight: 44 },
})
