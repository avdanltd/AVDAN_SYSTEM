import { AppState, Platform, type AppStateStatus } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager } from '@tanstack/react-query'

/**
 * Wires TanStack Query's connectivity/focus detection to React Native's real signals.
 *
 * Query's default `onlineManager` listens for browser `online`/`offline` window events, which
 * don't exist in React Native — `navigator.onLine` is unreliable there (undefined on native,
 * and even on Expo's web target it can disagree with the bundler's own polyfilled global). Left
 * unconfigured, the very first query fired can get stuck at `fetchStatus: 'paused'` forever:
 * `isLoading` reads `false` once a query is paused rather than fetching, which is indistinguishable
 * from "loaded, zero results" in a screen that only branches on `isLoading`/`isError` — the app
 * looks fully loaded while every query never actually ran. Call this once, from each mobile app's
 * root layout, before any query fires.
 */
export function configureQueryNetworking(): void {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(state.isConnected != null ? state.isConnected : true)
    })
  })

  function onAppStateChange(status: AppStateStatus) {
    // Web already has its own visibility-based focus handling; only override on native.
    if (Platform.OS !== 'web') {
      focusManager.setFocused(status === 'active')
    }
  }

  AppState.addEventListener('change', onAppStateChange)
}
