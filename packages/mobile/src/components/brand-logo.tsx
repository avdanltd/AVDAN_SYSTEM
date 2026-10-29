import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop, Rect, ClipPath, G } from 'react-native-svg'

import { brandColors, fonts } from '../theme/tokens'
import { useTheme } from '../theme/context'

/**
 * The AVDAN mark, drawn as vector rather than shipped as a bitmap so it stays crisp at every
 * size and can recolour for dark mode. Geometry is traced from `apps/api/static/logo.png`:
 * the arrowhead is two mirrored straight-edged wings meeting at a sharp apex, with a notch
 * near the base. Verified against the source: the outer edge is the line x = 50 - 0.5y and
 * the inner edge is x = 50 - 0.1325y, in a 100x100 box.
 */
const LEFT_WING = 'M50 0 L39.4 80 L27 90 L0.7 100 Z'
const RIGHT_WING = 'M50 0 L60.6 80 L73 90 L99.3 100 Z'

interface MarkProps {
  size?: number
  /** Render the blue squircle badge behind the arrow (as in the full logo lockup). */
  badge?: boolean
  style?: StyleProp<ViewStyle>
}

export function AvdanMark({ size = 40, badge = false, style }: MarkProps) {
  // The arrow is 100 wide x 100 tall in its own box; inside a badge it sits at ~56%.
  const inset = badge ? 22 : 0
  const span = 100 - inset * 2

  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="avdanGold" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={brandColors.accentTop} />
            <Stop offset="1" stopColor={brandColors.accentBottom} />
          </LinearGradient>
          <LinearGradient id="avdanBlue" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={brandColors.primaryLight} />
            <Stop offset="1" stopColor={brandColors.navy} />
          </LinearGradient>
          <ClipPath id="avdanSquircle">
            <Rect x="0" y="0" width="100" height="100" rx="23.5" ry="23.5" />
          </ClipPath>
        </Defs>

        {badge && (
          <G clipPath="url(#avdanSquircle)">
            <Rect x="0" y="0" width="100" height="100" fill="url(#avdanBlue)" />
          </G>
        )}

        <G
          transform={`translate(${inset}, ${inset}) scale(${span / 100})`}
        >
          <Path d={LEFT_WING} fill="url(#avdanGold)" />
          <Path d={RIGHT_WING} fill="url(#avdanGold)" />
        </G>
      </Svg>
    </View>
  )
}

interface LogoProps {
  /** Height of the mark in px. The wordmark scales with it. */
  size?: number
  /** Show the "AVDAN" wordmark beside the mark. */
  showWordmark?: boolean
  /** Optional line under the wordmark, e.g. "Rider". */
  suffix?: string
  badge?: boolean
  /** Force wordmark colour; defaults to the theme foreground so it works on any ground. */
  tint?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Full brand lockup. The wordmark is rendered as text in the brand display face rather than
 * as the bitmap from logo.png, because that bitmap's lettering is dark navy and disappears
 * against a dark background.
 */
export function AvdanLogo({
  size = 36,
  showWordmark = true,
  suffix,
  badge = false,
  tint,
  style,
}: LogoProps) {
  const { colors } = useTheme()
  const color = tint ?? colors.foreground

  return (
    <View style={[styles.row, style]}>
      <AvdanMark size={size} badge={badge} />
      {showWordmark && (
        <View style={styles.words}>
          <Text
            style={[
              styles.wordmark,
              { color, fontSize: size * 0.62, letterSpacing: size * 0.045 },
            ]}
          >
            AVDAN
          </Text>
          {suffix ? (
            <Text style={[styles.suffix, { color: colors.mutedForeground, fontSize: size * 0.3 }]}>
              {suffix}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  words: { justifyContent: 'center' },
  wordmark: { fontFamily: fonts.display, includeFontPadding: false },
  suffix: {
    fontFamily: fonts.sansMedium,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 1,
  },
})
