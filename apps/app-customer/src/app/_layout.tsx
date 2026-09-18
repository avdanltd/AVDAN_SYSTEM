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
  configureQueryNetworking,
  secureStorage,
  toastConfig,
  useAuthStore,
  useTheme,
} from '@avdan/mobile'
import Constants from 'expo-constants'
import { router } from 'expo-router'

import { useCartStore } from '@/modules/shop/store/cart.store'

SplashScreen.preventAutoHideAsync()

// The shared client takes its base URL and its 401 behaviour by injection so the package does
// not have to import expo-router or expo-constants itself. Must run before any query fires.
configureApiClient({
  baseUrl: (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:8000',
  wsUrl: Constants.expoConfig?.extra?.wsUrl as string | undefined,
  onUnauthorized: () => router.replace('/login'),
})

// React Query's default online detection listens for browser online/offline events, which don't
// exist in React Native — without this, queries can get stuck permanently "paused" (see the
// helper's own doc comment). Must also run before any query fires.
configureQueryNetworking()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
})

function AppShell() {
  const { colors, isDark } = useTheme()
  const [isHydrating, setIsHydrating] = useState(true)
  const setUser = useAuthStore((s) => s.setUser)
  const hydrateCart = useCartStore((s) => s.hydrate)
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
      // Nothing here may throw uncaught — `isHydrating` gates the entire app behind
      // `<BrandLoader />`, so any unhandled rejection (a corrupted/inaccessible secure-storage
      // entry, a platform quirk, anything) permanently strands the app on the loading screen
      // with no products, no navigation, nothing. Any failure here should degrade to "not logged
      // in" and let the public app load, never hang it.
      try {
        const { accessToken } = await secureStorage.getTokens()
        await Promise.all([
          (async () => {
            if (accessToken) {
              try {
                const user = await authService.getMe()
                setUser(user)
              } catch {
                await secureStorage.clear()
              }
            }
          })(),
          hydrateCart(),
        ])
      } catch {
        // Fall through to finally — proceed unauthenticated rather than hang forever.
      } finally {
        setIsHydrating(false)
      }
    }
    hydrate()
  }, [setUser, hydrateCart])

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
