import type { ExpoConfig } from 'expo/config'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws'
// Path to the Firebase `google-services.json` for Android push — an EAS "file" env var in cloud
// builds. Optional: without it the build still succeeds and push registration is skipped at
// runtime (see PUSH_AVAILABLE in @avdan/mobile), because Android can't get a push token without
// Firebase compiled in.
const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON

const config: ExpoConfig = {
  name: 'AVDAN Rider',
  slug: 'app-rider',
  owner: 'ejaycee',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'apprider',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#ffffff',
  extra: {
    apiUrl: API_URL,
    wsUrl: WS_URL,
    hasPushConfig: Boolean(GOOGLE_SERVICES_JSON),
    // Lets the JS side skip mounting the native Google map when this Android build has no key
    // (see delivery-map.tsx) — the SDK throws on a missing key rather than rendering blank.
    hasAndroidMapsKey: Boolean(process.env.GOOGLE_MAPS_API_KEY_ANDROID),
    eas: {
      projectId: '4001e53f-af61-43fd-9475-2a64a162345e',
    },
  },
  ios: {
    icon: './assets/images/icon.png',
    bundleIdentifier: 'com.avdanstore.rider',
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
    ...(GOOGLE_SERVICES_JSON ? { googleServicesFile: GOOGLE_SERVICES_JSON } : {}),
    package: 'com.avdanstore.rider',
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
    // react-native-maps wraps the native Google Maps SDK on Android, which — unlike iOS's
    // Apple Maps default — refuses to render without an API key baked into the manifest at
    // build time. Read directly from a plain (non-EXPO_PUBLIC_) env var since app.config.ts
    // only runs in Node during prebuild/build, never in the JS bundle. Until a real key is
    // set, the live map renders fine on iOS but shows a blank grey tile on Android.
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
      },
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    ['expo-notifications', { color: '#0A2480' }],
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
