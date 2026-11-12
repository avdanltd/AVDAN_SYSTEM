import { Linking, Pressable, StyleSheet, Text } from 'react-native'

import { fonts, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { Card } from './ui'

/** "Need help? Email …" card for the profile screen of every app. */
export function ContactSupport({ email }: { email: string }) {
  const { colors } = useTheme()
  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: colors.foreground }]}>Need help?</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Write to the AVDAN team and we’ll get back to you.
      </Text>
      <Pressable
        onPress={() => void Linking.openURL(`mailto:${email}`)}
        accessibilityRole="link"
        accessibilityLabel={`Email ${email}`}
      >
        <Text style={[styles.email, { color: colors.primary }]}>{email}</Text>
      </Pressable>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
  body: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  email: { fontFamily: fonts.sansSemiBold, fontSize: 14, textDecorationLine: 'underline' },
})
