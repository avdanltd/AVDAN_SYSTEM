import { View } from 'react-native'

import { RiderHeader } from '@/components/rider-header'
import { OrdersList } from '@/modules/rider/components/orders-list'
import { useTheme } from '@avdan/mobile'
export default function OrdersScreen() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RiderHeader title="My Orders" />
      <OrdersList />
    </View>
  )
}
