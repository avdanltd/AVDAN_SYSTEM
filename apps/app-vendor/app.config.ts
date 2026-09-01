import type { ExpoConfig } from 'expo/config'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws'

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
  extra: {
    apiUrl: API_URL,
    wsUrl: WS_URL,
    eas: {
      projectId: '4224d0fc-fb18-432f-bfc1-5add0a663507',
    },
  },
  ios: {
    icon: './assets/images/icon.png',
    bundleIdentifier: 'com.avdanstore.vendor',
    supportsTablet: true,
    infoPlist: {
      // Vendors attach product photos when creating or editing a listing.
      NSCameraUsageDescription: 'AVDAN Vendor uses the camera to photograph your products.',
      NSPhotoLibraryUsageDescription:
        'AVDAN Vendor needs photo access so you can attach product images to your listings.',
    },
  },
  android: {
    package: 'com.avdanstore.vendor',
    adaptiveIcon: {
      backgroundColor: '#E07A06',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['CAMERA', 'READ_MEDIA_IMAGES'],
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
        backgroundColor: '#0A2480',
        dark: { backgroundColor: '#080d1c' },
        image: './assets/images/splash-icon.png',
        imageWidth: 128,
        resizeMode: 'contain',
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
