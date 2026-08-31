import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvdanMark, fonts, initials, radius, spacing, useSession, useTheme } from '@avdan/mobile'

export function RiderHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useSession()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.sm,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.left}>
        <AvdanMark size={30} badge />
        <View>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={() => router.push('/profile')}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        style={({ pressed }) => [
          styles.avatar,
          { backgroundColor: colors.primaryMuted, borderColor: colors.border },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={[styles.avatarText, { color: colors.primary }]}>{initials(user?.name)}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 19, includeFontPadding: false },
  subtitle: { fontFamily: fonts.sans, fontSize: 12, marginTop: 1 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 13 },
})
