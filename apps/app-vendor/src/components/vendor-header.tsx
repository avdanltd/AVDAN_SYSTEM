import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AvdanMark, Blink, fonts, initials, radius, spacing, useSession, useTheme } from '@avdan/mobile'

import { useSetStoreOpen, useVendorProfile } from '../modules/vendor/hooks/use-vendor'

export function VendorHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useSession()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { data: vendor } = useVendorProfile()
  const setOpen = useSetStoreOpen()
  const isOpen = vendor?.is_open ?? true

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

      {vendor ? (
        <Pressable
          onPress={() => setOpen.mutate(!isOpen)}
          disabled={setOpen.isPending}
          accessibilityRole="switch"
          accessibilityState={{ checked: isOpen }}
          accessibilityLabel={isOpen ? 'Store is open. Tap to close it.' : 'Store is closed. Tap to open it.'}
          style={[
            styles.storePill,
            {
              borderColor: isOpen ? colors.success : colors.destructive,
              backgroundColor: isOpen ? colors.successMuted : colors.destructiveMuted,
            },
            setOpen.isPending && { opacity: 0.6 },
          ]}
        >
          {/* The dot always blinks (as requested) so the vendor never forgets the store's state; red when closed. */}
          <Blink active>
            <View style={[styles.dot, { backgroundColor: isOpen ? colors.success : colors.destructive }]} />
          </Blink>
          <Text style={[styles.storeText, { color: isOpen ? colors.success : colors.destructive }]}>
            {isOpen ? 'Open' : 'Closed'}
          </Text>
        </Pressable>
      ) : null}

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
        <Text style={[styles.avatarText, { color: colors.primary }]}>{initials(user?.name, 'V')}</Text>
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
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginRight: spacing.sm,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  storeText: { fontFamily: fonts.sansBold, fontSize: 12.5 },
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
