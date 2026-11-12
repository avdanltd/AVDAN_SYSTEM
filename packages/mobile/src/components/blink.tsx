import { useEffect, useRef, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

/**
 * Makes its children blink until `active` is false — for state the user must not forget (store
 * closed, a delivery code waiting to be used). Holds still for people with "reduce motion" on.
 */
export function Blink({
  active = true,
  children,
  style,
}: {
  active?: boolean
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!active) {
      opacity.setValue(1)
      return
    }
    let loop: Animated.CompositeAnimation | null = null
    let cancelled = false
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.25, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      )
      loop.start()
    })
    return () => {
      cancelled = true
      loop?.stop()
      opacity.setValue(1)
    }
  }, [active, opacity])

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>
}
