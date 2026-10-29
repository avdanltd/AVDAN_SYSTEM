import { useEffect, useRef, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { AvdanMark } from './brand-logo'

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

export function Card({ style, ...props }: ViewProps) {
  const { colors, shadowCard } = useTheme()
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: spacing.lg,
          ...shadowCard,
        },
        style,
      ]}
      {...props}
    />
  )
}

/* ── Loading ──────────────────────────────────────────────────────────────── */

export function Spinner({ color, size }: { color?: string; size?: 'small' | 'large' }) {
  const { colors } = useTheme()
  return <ActivityIndicator color={color ?? colors.primary} size={size} />
}

/**
 * The brand loader: the AVDAN arrow breathing in place. Used anywhere a full-area wait
 * would otherwise show a generic spinner — app boot, route transitions, first data load.
 */
export function BrandLoader({ label, size = 64 }: { label?: string; size?: number }) {
  const { colors } = useTheme()
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.06] })
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
  const lift = pulse.interpolate({ inputRange: [0, 1], outputRange: [4, -4] })

  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      <Animated.View style={{ transform: [{ scale }, { translateY: lift }], opacity }}>
        <AvdanMark size={size} />
      </Animated.View>
      {label ? (
        <Text style={[styles.loaderLabel, { color: colors.mutedForeground }]}>{label}</Text>
      ) : null}
    </View>
  )
}

/** Shimmer placeholder block, for list/detail skeletons. */
export function Skeleton({ height = 16, width, style }: { height?: number; width?: number | string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme()
  const shimmer = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [shimmer])

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] })

  return (
    <Animated.View
      style={[
        { height, width: (width as number) ?? '100%', backgroundColor: colors.skeleton, borderRadius: radius.sm, opacity },
        style,
      ]}
    />
  )
}

/* ── Badge ────────────────────────────────────────────────────────────────── */

export function Badge({
  label,
  bg,
  fg,
  style,
}: {
  label: string
  bg: string
  fg: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.badgeText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

/* ── Button ───────────────────────────────────────────────────────────────── */

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost' | 'accent'

export function Button({
  label,
  onPress,
  variant = 'default',
  disabled,
  loading,
  size = 'md',
  icon,
  style,
  fullWidth = true,
}: {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
  fullWidth?: boolean
}) {
  const { colors } = useTheme()
  const isDisabled = disabled || loading

  const bg: Record<ButtonVariant, string> = {
    default: colors.primary,
    destructive: colors.destructive,
    accent: colors.accent,
    outline: 'transparent',
    ghost: 'transparent',
  }
  const fg: Record<ButtonVariant, string> = {
    default: colors.primaryForeground,
    destructive: colors.destructiveForeground,
    accent: colors.accentForeground,
    outline: colors.foreground,
    ghost: colors.primary,
  }

  const pad = size === 'lg' ? spacing.lg : size === 'sm' ? spacing.sm + 2 : spacing.md + 2

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg[variant],
          paddingVertical: pad,
          // 44pt minimum touch target.
          minHeight: size === 'sm' ? 40 : 48,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: fullWidth ? spacing.lg : spacing.xl,
        },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.border },
        isDisabled && { opacity: 0.55 },
        pressed && !isDisabled && { opacity: 0.82, transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text
            style={[
              styles.buttonText,
              { color: fg[variant], fontSize: size === 'lg' ? 16 : 15 },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

/* ── Empty state ──────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>{icon}</View>
      ) : null}
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      {description ? (
        <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{description}</Text>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  )
}

/* ── Section heading ──────────────────────────────────────────────────────── */

export function SectionTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme()
  return <Text style={[styles.sectionTitle, { color: colors.foreground }, style]}>{children}</Text>
}

/** A labelled row, e.g. in Profile. */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  loaderLabel: { fontFamily: fonts.sansMedium, fontSize: 13, letterSpacing: 0.3 },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11.5, fontFamily: fonts.sansSemiBold, letterSpacing: 0.3 },
  button: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonText: { fontFamily: fonts.sansSemiBold, letterSpacing: 0.2 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontFamily: fonts.display, fontSize: 19 },
  emptyDesc: { fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 280 },
  emptyAction: { marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: spacing.md },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
  },
  infoLabel: { fontFamily: fonts.sans, fontSize: 14 },
  infoValue: { fontFamily: fonts.sansSemiBold, fontSize: 14, flexShrink: 1, textAlign: 'right' },
})
