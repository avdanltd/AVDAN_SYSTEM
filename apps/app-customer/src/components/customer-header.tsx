import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ShoppingCart } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AvdanMark, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { cartCount, useCartStore } from '@/modules/shop/store/cart.store'

export function CustomerHeader({ title }: { title: string }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const lines = useCartStore((s) => s.lines)
  const count = cartCount(lines)

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border, backgroundColor: colors.background },
      ]}
    >
      <View style={styles.left}>
        <AvdanMark size={30} badge />
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/cart')}
        accessibilityRole="button"
        accessibilityLabel="Open cart"
        style={({ pressed }) => [styles.cartBtn, { backgroundColor: colors.primaryMuted }, pressed && { opacity: 0.7 }]}
      >
        <ShoppingCart size={18} color={colors.primary} />
        {count > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.accentForeground }]}>
              {count > 9 ? '9+' : count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 19, includeFontPadding: false },
  cartBtn: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 9.5 },
})
