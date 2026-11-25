import type { ExpoConfig } from 'expo/config'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws'
// Path to the Firebase `google-services.json` for Android push — an EAS "file" env var in cloud
// builds. Optional: without it the build still succeeds and push registration is skipped at
// runtime (see PUSH_AVAILABLE in @avdan/mobile), because Android can't get a push token without
// Firebase compiled in.
const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON

const config: ExpoConfig = {
  name: 'AVDAN Vendor',
  slug: 'app-vendor',
  owner: 'ejaycee',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'avdanvendor',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#ffffff',
  // OTA updates (EAS Update): a build only receives updates made for the same app version.
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: 'https://u.expo.dev/4224d0fc-fb18-432f-bfc1-5add0a663507' },
  extra: {
    apiUrl: API_URL,
    wsUrl: WS_URL,
    hasPushConfig: Boolean(GOOGLE_SERVICES_JSON),
    // Lets the JS side skip mounting the native Google map when this Android build has no key
    // (the SDK throws on a missing key rather than rendering blank). iPhones use Apple Maps.
    hasAndroidMapsKey: Boolean(process.env.GOOGLE_MAPS_API_KEY_ANDROID),
    eas: {
      projectId: '4224d0fc-fb18-432f-bfc1-5add0a663507',
    },
  },
  ios: {
    icon: './assets/images/icon.png',
    bundleIdentifier: 'com.avdanstore.vendor',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Vendors attach product photos when creating or editing a listing.
      NSCameraUsageDescription: 'AVDAN Vendor uses the camera to photograph your products.',
      NSPhotoLibraryUsageDescription:
        'AVDAN Vendor needs photo access so you can attach product images to your listings.',
    },
  },
  android: {
    ...(GOOGLE_SERVICES_JSON ? { googleServicesFile: GOOGLE_SERVICES_JSON } : {}),
    package: 'com.avdanstore.vendor',
    adaptiveIcon: {
      backgroundColor: '#9EA6B2',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Android's Google Maps SDK needs a key in the manifest at build time (an EAS secret, never in git).
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
      },
    },
    permissions: ['CAMERA'],
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
        // Foreground only: used once, when the vendor taps "Use my current location" to pin the
        // pickup point that delivery fees and rider matching are measured from.
        locationWhenInUsePermission:
          'AVDAN Vendor uses your location once to set your store pickup point, which is used to price deliveries.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'AVDAN Vendor needs photo access to attach images to your product listings.',
        cameraPermission: 'AVDAN Vendor uses the camera to photograph your products.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
}

export default config
