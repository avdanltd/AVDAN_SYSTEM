import { View } from 'react-native'

import { RiderHeader } from '@/components/rider-header'
import { Profile } from '@/modules/rider/components/profile'
import { useTheme } from '@avdan/mobile'
export default function ProfileScreen() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RiderHeader title="Profile" />
      <Profile />
    </View>
  )
}
