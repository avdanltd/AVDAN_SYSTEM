import { Stack } from 'expo-router'
import { fonts, useTheme } from '@avdan/mobile'

export default function VendorsLayout() {
  const { colors } = useTheme()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Stores' }} />
      <Stack.Screen name="[slug]/index" options={{ headerShown: true }} />
    </Stack>
  )
}
