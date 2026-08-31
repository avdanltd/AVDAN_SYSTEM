import { View } from 'react-native'

import { VendorHeader } from '@/components/vendor-header'
import { Profile } from '@/modules/vendor/components/profile'
import { useTheme } from '@avdan/mobile'
export default function ProfileScreen() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <VendorHeader title="Profile" />
      <Profile />
    </View>
  )
}
