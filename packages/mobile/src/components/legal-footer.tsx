import { Linking, StyleSheet, Text } from 'react-native'

import { fonts } from '../theme/tokens'
import { useTheme } from '../theme/context'

const SITE = 'https://avdanstore.com'

/** "By signing in you agree to our Terms and Privacy Policy": under the sign-in button of every app. */
export function LegalFooter() {
  const { colors } = useTheme()
  const link = { color: colors.primary, textDecorationLine: 'underline' as const }
  return (
    <Text style={[styles.text, { color: colors.subtleForeground }]}>
      By signing in you agree to our{' '}
      <Text style={link} onPress={() => void Linking.openURL(`${SITE}/terms`)} accessibilityRole="link">
        Terms
      </Text>{' '}
      and{' '}
      <Text style={link} onPress={() => void Linking.openURL(`${SITE}/privacy`)} accessibilityRole="link">
        Privacy Policy
      </Text>
      .
    </Text>
  )
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, textAlign: 'center' },
})
