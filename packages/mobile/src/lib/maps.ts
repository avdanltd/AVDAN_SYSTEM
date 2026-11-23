import { Platform } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'

/**
 * Whether the native map can be mounted in this build.
 *
 * iPhones use Apple Maps and need no key. Android's Google Maps SDK needs an API key baked into the
 * app at build time and throws when one is missing, so an Android build made without
 * GOOGLE_MAPS_API_KEY_ANDROID must not mount a map (callers show a text/link fallback instead).
 * Expo Go ships its own key, so it is always fine.
 */
export const MAPS_AVAILABLE =
  Platform.OS !== 'android' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.expoConfig?.extra?.hasAndroidMapsKey === true
