import { StyleSheet, Text, View } from 'react-native'

import { Blink } from './blink'
import { Button } from './ui'
import { spacing, radius, fonts } from '../theme/tokens'
import { useTheme } from '../theme/context'

/**
 * The "use my current location" call-to-action, deliberately loud: people skip a plain outline
 * button, yet without a location the delivery fee can't be priced / a rider can't find the pickup.
 * The button blinks red until a location is captured (and holds still with "reduce motion" on).
 */
export function LocationPrompt({
  instruction,
  captured,
  capturedText,
  loading,
  onPress,
  buttonLabel = 'Use my current location',
  updateLabel = 'Update my location',
}: {
  instruction: string
  captured: boolean
  capturedText?: string
  loading?: boolean
  onPress: () => void
  buttonLabel?: string
  updateLabel?: string
}) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.box,
        captured
          ? { borderColor: colors.success, backgroundColor: colors.card }
          : { borderColor: colors.destructive, backgroundColor: colors.destructiveMuted },
      ]}
    >
      <Text style={[styles.instruction, { color: colors.foreground }]}>
        {'👉  '}
        {instruction}
      </Text>
      <Blink active={!captured && !loading}>
        <Button
          label={loading ? 'Locating…' : captured ? updateLabel : buttonLabel}
          variant={captured ? 'outline' : 'destructive'}
          loading={loading}
          onPress={onPress}
        />
      </Blink>
      {captured && capturedText ? (
        <Text style={[styles.done, { color: colors.success }]}>{capturedText}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  instruction: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, lineHeight: 20 },
  done: { fontFamily: fonts.sansMedium, fontSize: 13 },
})
