import type { ReactNode } from 'react'
import type { ImageSourcePropType } from 'react-native'
import { ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'

import { AvdanMark } from './brand-logo'
import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'

const BACK_BUTTON_SIZE = 36

interface TrustBadge {
  value: string
  label: string
}

interface AuthSplitShellProps {
  /** Hero photo for the brand band — each app supplies its own (see STATUS_DESIGN.md §6). */
  imageSource: ImageSourcePropType
  tagline: string
  badges?: TrustBadge[]
  children: ReactNode
  /**
   * Shows a back button over the hero when provided. Omit it for apps where login is mandatory
   * (vendor/rider — there's nowhere meaningful to go back to before signing in). Pass it for
   * app-customer, where browsing is public and login is only reached from an in-app prompt —
   * without a way out, a customer who taps "Sign in" by mistake (or changes their mind) is
   * stranded on this screen with no way back to the app they were just using.
   */
  onBack?: () => void
}

/**
 * The premium auth split-shell, native version — mirrors `@avdan/ui`'s `AuthSplitShell` for web
 * (same photo-led dark band + rising form sheet pattern) so the flagship auth moment reads
 * identically across platforms (STATUS_DESIGN.md §0, §6 Phase B). A flat dark scrim stands in for
 * the web version's gradient overlay for now — no new native dependency (expo-linear-gradient)
 * for a cosmetic difference; upgrade later if the flat scrim reads as flat in practice.
 */
export function AuthSplitShell({ imageSource, tagline, badges, children, onBack }: AuthSplitShellProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ImageBackground
          source={imageSource}
          style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}
          resizeMode="cover"
        >
          <View style={styles.scrim} />
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={[styles.backButton, { top: insets.top + spacing.sm }]}
            >
              <ArrowLeft size={20} color="#ffffff" />
            </Pressable>
          ) : null}
          {/* Reserves the back button's row so it doesn't sit on top of the mark below it —
              both anchor to the same corner otherwise. */}
          <View
            style={[
              styles.heroContent,
              onBack ? { marginTop: BACK_BUTTON_SIZE + spacing.sm } : null,
            ]}
          >
            <AvdanMark size={44} badge style={styles.badgeShadow} />
            <Text style={styles.tagline}>{tagline}</Text>
            {badges && badges.length > 0 && (
              <View style={styles.badgeRow}>
                {badges.map((b) => (
                  <View key={b.label}>
                    <Text style={styles.badgeValue}>{b.value}</Text>
                    <Text style={styles.badgeLabel}>{b.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ImageBackground>

        <ScrollView
          style={[styles.sheet, { backgroundColor: colors.background }]}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { height: 220, justifyContent: 'space-between', padding: spacing.xl },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,13,28,0.6)',
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroContent: { gap: spacing.md },
  badgeShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
  tagline: {
    color: '#ffffff',
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 280,
  },
  badgeRow: { flexDirection: 'row', gap: spacing.xl },
  badgeValue: { color: '#ffffff', fontFamily: fonts.display, fontSize: 20 },
  badgeLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.sans, fontSize: 11.5 },
  sheet: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
  },
  sheetContent: { padding: spacing.xl, gap: spacing.xl },
})
