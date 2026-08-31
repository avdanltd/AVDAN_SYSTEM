import type { ExpoConfig } from 'expo/config'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws'

const config: ExpoConfig = {
  name: 'AVDAN Rider',
  slug: 'app-rider',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'apprider',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#ffffff',
  extra: {
    apiUrl: API_URL,
    wsUrl: WS_URL,
  },
  ios: {
    icon: './assets/images/icon.png',
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'AVDAN Rider uses your location to broadcast your position to dispatch while you are online.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'AVDAN Rider needs background location so dispatch can track you en route even when the app is not open.',
      NSCameraUsageDescription: 'AVDAN Rider uses the camera to capture delivery proof photos.',
      UIBackgroundModes: ['location'],
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0A2480',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'CAMERA',
    ],
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        // Brand navy from the badge gradient; the arrow sits on it as the splash mark.
        backgroundColor: '#0A2480',
        dark: { backgroundColor: '#080d1c' },
        image: './assets/images/splash-icon.png',
        imageWidth: 128,
        resizeMode: 'contain',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'AVDAN Rider needs background location so dispatch can track you en route even when the app is not open.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
}

export default config
