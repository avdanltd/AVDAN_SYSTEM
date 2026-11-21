import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { GitBranch } from 'lucide-react-native'
import { Button, Card, fonts, spacing, useTheme } from '@avdan/mobile'

import { useMyBusiness } from '../hooks/use-vendor'

const KEY = 'avdan_vendor_branch_prompt_dismissed'

/** One-time nudge on the dashboard: "Is this store a branch of another business?". Gone once the
 * store is linked, has a request waiting, or the vendor says it is independent (kept on this device). */
export function BranchPrompt() {
  const { colors } = useTheme()
  const router = useRouter()
  const { data } = useMyBusiness()
  const [dismissed, setDismissed] = useState(true) // hidden until storage has been read

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((v) => setDismissed(v === '1'))
      .catch(() => setDismissed(false))
  }, [])

  if (!data || dismissed || data.business || data.request?.status === 'pending') return null

  const dismiss = () => {
    setDismissed(true)
    SecureStore.setItemAsync(KEY, '1').catch(() => {})
  }

  return (
    <Card style={[styles.card, { backgroundColor: colors.primaryMuted }]}>
      <View style={styles.head}>
        <GitBranch size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>Is this store a branch of another business?</Text>
      </View>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        If your business has other stores on AVDAN, link them so customers see one brand with all its branches.
      </Text>
      <Button label="Yes, link my branches" size="sm" fullWidth={false} onPress={() => router.push('/profile/branches')} />
      <Button label="No, we're independent" size="sm" variant="outline" fullWidth={false} onPress={dismiss} />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, flex: 1 },
  body: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
})
