import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Power, CheckCircle2 } from 'lucide-react-native'
import { Spinner, fonts, radius, useTheme } from '@avdan/mobile'

const TRACK_HEIGHT = 88
const KNOB_SIZE = 72
const KNOB_INSET = (TRACK_HEIGHT - KNOB_SIZE) / 2

interface StatusToggleProps {
  isOnline: boolean
  onToggle: (next: boolean) => void
  isPending?: boolean
}

export function StatusToggle({ isOnline, onToggle, isPending }: StatusToggleProps) {
  const { colors, shadowCard } = useTheme()
  const [trackWidth, setTrackWidth] = useState(0)
  const progress = useSharedValue(isOnline ? 1 : 0)

  useEffect(() => {
    progress.value = withSpring(isOnline ? 1 : 0, { damping: 18, stiffness: 180 })
  }, [isOnline, progress])

  const maxOffset = Math.max(trackWidth - KNOB_SIZE - KNOB_INSET * 2, 0)

  const knobStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: progress.value * maxOffset }],
    }),
    [maxOffset],
  )

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isOnline, disabled: isPending }}
      accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
      disabled={isPending}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      onPress={() => onToggle(!isOnline)}
      style={[styles.track, { backgroundColor: isOnline ? colors.accent : colors.primary }]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Text
          style={[
            styles.label,
            { color: isOnline ? colors.accentForeground : colors.primaryForeground },
            isOnline ? styles.labelAlignLeft : styles.labelAlignRight,
          ]}
        >
          {isOnline ? 'TAP TO GO OFFLINE' : 'TAP TO GO ONLINE'}
        </Text>
      </View>

      <Animated.View
        style={[styles.knob, { left: KNOB_INSET, backgroundColor: colors.card, ...shadowCard }, knobStyle]}
      >
        {isPending ? (
          <Spinner color={isOnline ? colors.accent : colors.primary} />
        ) : isOnline ? (
          <CheckCircle2 size={32} color={colors.accent} />
        ) : (
          <Power size={32} color={colors.primary} />
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  knob: {
    position: 'absolute',
    top: KNOB_INSET,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  labelAlignLeft: {
    paddingRight: KNOB_SIZE + KNOB_INSET,
  },
  labelAlignRight: {
    paddingLeft: KNOB_SIZE + KNOB_INSET,
  },
})
