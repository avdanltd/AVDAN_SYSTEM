import { View, StyleSheet, Text } from 'react-native'
import { useTheme, fonts } from '@avdan/mobile'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Profile } from '@/modules/shop/components/profile'
import { SignInGate } from '@/modules/shop/components/sign-in-gate'

export default function ProfileScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
      </View>
      <SignInGate action="view your profile">
        <Profile />
      </SignInGate>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: fonts.display, fontSize: 22 },
})
