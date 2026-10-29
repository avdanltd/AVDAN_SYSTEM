import { View } from 'react-native'
import { useTheme, fonts } from '@avdan/mobile'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text, StyleSheet } from 'react-native'

import { Cart } from '@/modules/shop/components/cart'

export default function CartScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Your Cart</Text>
      </View>
      <Cart />
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: fonts.display, fontSize: 22 },
})
