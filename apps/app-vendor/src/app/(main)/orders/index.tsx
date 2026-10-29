import { View } from 'react-native'

import { VendorHeader } from '@/components/vendor-header'
import { OrdersList } from '@/modules/vendor/components/orders-list'
import { useTheme } from '@avdan/mobile'
export default function OrdersScreen() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <VendorHeader title="Orders" />
      <OrdersList />
    </View>
  )
}
