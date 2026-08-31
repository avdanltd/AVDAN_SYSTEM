import { useEffect, useState } from 'react'
import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { useFonts } from 'expo-font'
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque'
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
} from '@expo-google-fonts/playfair-display'

import {
  BrandLoader,
  ThemeProvider,
  authService,
  configureApiClient,
  secureStorage,
  toastConfig,
  useAuthStore,
  useTheme,
} from '@avdan/mobile'
import Constants from 'expo-constants'
import { router } from 'expo-router'

SplashScreen.preventAutoHideAsync()

// The shared client takes its base URL and its 401 behaviour by injection so the package does
// not have to import expo-router or expo-constants itself. Must run before any query fires.
configureApiClient({
  baseUrl: (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:8000',
  onUnauthorized: () => router.replace('/login'),
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
})

function AppShell() {
  const { colors, isDark } = useTheme()
  const [isHydrating, setIsHydrating] = useState(true)
  const setUser = useAuthStore((s) => s.setUser)
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
  })

  // Keep the native root background in step with the theme so rotations and overscroll
  // don't flash white in dark mode.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {})
  }, [colors.background])

  useEffect(() => {
    async function hydrate() {
      const { accessToken } = await secureStorage.getTokens()
      if (accessToken) {
        try {
          const user = await authService.getMe()
          setUser(user)
        } catch {
          await secureStorage.clear()
        }
      }
      setIsHydrating(false)
    }
    hydrate()
  }, [setUser])

  useEffect(() => {
    if (!isHydrating && fontsLoaded) {
      SplashScreen.hideAsync()
    }
  }, [isHydrating, fontsLoaded])

  if (isHydrating || !fontsLoaded) {
    return <BrandLoader />
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
      <Toast config={toastConfig} />
    </>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AppShell />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
