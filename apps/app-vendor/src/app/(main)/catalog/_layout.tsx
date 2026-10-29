import { Stack } from 'expo-router'
import { fonts, useTheme } from '@avdan/mobile'

export default function CatalogLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'Add Product' }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit Product' }} />
    </Stack>
  )
}
