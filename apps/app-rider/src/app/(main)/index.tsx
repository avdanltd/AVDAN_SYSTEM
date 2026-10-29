import { View } from 'react-native'

import { RiderHeader } from '@/components/rider-header'
import { Dashboard } from '@/modules/rider/components/dashboard'
import { useTheme } from '@avdan/mobile'
export default function HomeScreen() {
  const { colors } = useTheme()
  // Dashboard is its own ScrollView (it owns pull-to-refresh), so this must NOT wrap it
  // in another one — nested vertical ScrollViews break scrolling and the refresh gesture.
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RiderHeader title="AVDAN Rider" subtitle="Rider portal" />
      <Dashboard />
    </View>
  )
}
