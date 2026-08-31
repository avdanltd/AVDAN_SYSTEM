import { View } from 'react-native'
import { useTheme } from '@avdan/mobile'

import { CustomerHeader } from '@/components/customer-header'
import { Home } from '@/modules/shop/components/home'

export default function HomeScreen() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CustomerHeader title="AVDAN" />
      <Home />
    </View>
  )
}
