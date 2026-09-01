import type { ExpoConfig } from 'expo/config'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws'

const config: ExpoConfig = {
  name: 'AVDAN',
  slug: 'app-customer',
  owner: 'ejaycee',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  // Paystack redirects here when checkout finishes. Must match
  // `payment_callback_url_mobile` in the API settings, or the browser will not hand control back.
  scheme: 'avdancustomer',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#ffffff',
  extra: {
    apiUrl: API_URL,
    wsUrl: WS_URL,
    eas: {
      projectId: '3bb6b962-86e7-4622-b6be-45febf7e8dfa',
    },
  },
  ios: {
    icon: './assets/images/icon.png',
    bundleIdentifier: 'com.avdanstore.customer',
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'AVDAN uses your location to suggest a delivery address and show where your order is.',
    },
  },
  android: {
    package: 'com.avdanstore.customer',
    adaptiveIcon: {
      backgroundColor: '#06144E',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    // expo-web-browser ships no config plugin — it's a pure JS API (openAuthSessionAsync),
    // nothing to configure natively. Listing it here would break `expo prebuild`/EAS builds
    // with "does not contain a valid config plugin".
    [
      'expo-splash-screen',
      {
        backgroundColor: '#06144E',
        dark: { backgroundColor: '#080d1c' },
        image: './assets/images/splash-icon.png',
        imageWidth: 128,
        resizeMode: 'contain',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
}

export default config
