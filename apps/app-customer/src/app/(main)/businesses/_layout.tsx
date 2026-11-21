import { Stack } from 'expo-router'
import { fonts, useTheme } from '@avdan/mobile'

export default function BusinessesLayout() {
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
      <Stack.Screen name="[slug]" options={{ title: 'Business' }} />
    </Stack>
  )
}
