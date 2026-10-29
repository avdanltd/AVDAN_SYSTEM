import { View } from 'react-native'

import { VendorHeader } from '@/components/vendor-header'
import { Dashboard } from '@/modules/vendor/components/dashboard'
import { useTheme } from '@avdan/mobile'
export default function HomeScreen() {
  const { colors } = useTheme()
  // Dashboard owns its own ScrollView + pull-to-refresh; do not nest another one here.
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <VendorHeader title="AVDAN Vendor" subtitle="Seller portal" />
      <Dashboard />
    </View>
  )
}
