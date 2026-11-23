import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import * as SecureStore from 'expo-secure-store'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Volume2, VolumeX } from 'lucide-react-native'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { Blink } from './blink'

// The same two rising beeps as the web alert (880 Hz, then 1175 Hz), as a small bundled file.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHIME = require('../../assets/chime.wav')
const DEFAULT_REPEAT_MS = 8_000

/**
 * Alert chime with an on/off preference kept on this device. While `active` it chimes (and
 * vibrates) now and then again every `repeatMs`, but only while the app is open on screen: when
 * the phone is locked or the app is in the background, push notifications take over.
 */
export function useAlertChime({
  active,
  storageKey,
  repeatMs = DEFAULT_REPEAT_MS,
}: {
  active: boolean
  storageKey: string
  repeatMs?: number
}) {
  const player = useAudioPlayer(CHIME)
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => {
    SecureStore.getItemAsync(storageKey)
      .then((v) => setSoundOn(v !== 'off'))
      .catch(() => undefined)
  }, [storageKey])

  useEffect(() => {
    // Alerts should be heard even with the phone's silent switch on.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined)
  }, [])

  const ring = useCallback(() => {
    if (AppState.currentState !== 'active') return
    try {
      void player.seekTo(0)
      player.play()
    } catch {
      /* audio unavailable: the banner and vibration still work */
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
  }, [player])

  useEffect(() => {
    if (!active || !soundOn) return
    ring()
    const id = setInterval(ring, repeatMs)
    return () => clearInterval(id)
  }, [active, soundOn, repeatMs, ring])

  const toggle = useCallback(() => {
    setSoundOn((on) => {
      SecureStore.setItemAsync(storageKey, on ? 'off' : 'on').catch(() => undefined)
      return !on
    })
  }, [storageKey])

  return { soundOn, toggle }
}

/**
 * "NEW ORDER · 2": a throbbing red bar across the top of the app while something is waiting for
 * the person, with a chime and a mute button. Tapping the bar opens the place to deal with it.
 * Nothing renders when `count` is 0.
 */
export function AttentionBanner({
  count,
  label,
  noun,
  onPress,
  storageKey,
}: {
  count: number
  label: string
  noun: string
  onPress: () => void
  storageKey: string
}) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { soundOn, toggle } = useAlertChime({ active: count > 0, storageKey })
  if (count <= 0) return null

  return (
    <View style={[styles.wrap, { backgroundColor: colors.destructive, marginTop: insets.top + spacing.sm }]}>
      <Blink>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${count} ${noun}${count === 1 ? '' : 's'} waiting. Open.`}
          style={styles.main}
        >
          <Text style={[styles.text, { color: colors.destructiveForeground }]}>
            {label.toUpperCase()} · {count}
          </Text>
        </Pressable>
      </Blink>
      <Pressable
        onPress={toggle}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={soundOn ? 'Mute the alert sound' : 'Turn the alert sound on'}
        style={styles.sound}
      >
        {soundOn ? <Volume2 size={18} color={colors.destructiveForeground} /> : <VolumeX size={18} color={colors.destructiveForeground} />}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, marginHorizontal: spacing.md },
  main: { flex: 1, paddingVertical: 4 },
  text: { fontFamily: fonts.sansSemiBold, fontSize: 14, letterSpacing: 0.6 },
  sound: { paddingLeft: spacing.md },
})
