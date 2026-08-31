import { View, StyleSheet, Text } from 'react-native'
import { useTheme, fonts } from '@avdan/mobile'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { OrdersList } from '@/modules/shop/components/orders-list'

export default function OrdersScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Orders</Text>
      </View>
      <OrdersList />
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: fonts.display, fontSize: 22 },
})
