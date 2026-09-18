import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Notifications from 'expo-notifications'

import { authService } from '../auth/services/auth.service'
import { useAuthStore } from '../auth/store/auth.store'

/**
 * Push notifications for every AVDAN mobile app.
 *
 * The backend sends through Expo's push service (apps/api/workers/tasks/notifications.py), so the
 * app's only job is to hand over its Expo push token after sign-in — and to route a tapped
 * notification to the order it's about.
 *
 * Guarded so a build without push credentials never touches the native push stack:
 *  - Android needs Firebase (`google-services.json`) compiled in; without it
 *    `getExpoPushTokenAsync` throws. Each app's app.config.ts sets `extra.hasPushConfig` only
 *    when GOOGLE_SERVICES_JSON was provided at build time.
 *  - Expo Go no longer supports remote push on Android (SDK 53+), so dev sessions skip it too.
 *  - iOS without APNs credentials just fails to get a token — caught, and the app carries on.
 */
export const PUSH_AVAILABLE =
  Platform.OS !== 'web' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  (Platform.OS !== 'android' || Constants.expoConfig?.extra?.hasPushConfig === true)

if (PUSH_AVAILABLE) {
  // Show pushes that arrive while the app is open, instead of silently dropping them.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
}

async function registerDevice(): Promise<void> {
  if (Platform.OS === 'android') {
    // Must match the `channelId` the backend sends with ("default").
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.MAX,
    })
  }

  const existing = await Notifications.getPermissionsAsync()
  const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted
  if (!granted) return

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  await authService.savePushToken(token)
}

interface UsePushNotificationsOptions {
  /** Called with the order id when the user taps a push about an order. */
  onOpenOrder: (orderId: string) => void
}

/**
 * Mount once in the app's root layout. Registers this device for the signed-in user (again on
 * every sign-in, so a shared phone follows whoever is logged in) and opens the order when a push
 * is tapped — including the tap that cold-launched the app.
 */
export function usePushNotifications({ onOpenOrder }: UsePushNotificationsOptions): void {
  const userId = useAuthStore((s) => s.user?.id)
  const lastResponse = Notifications.useLastNotificationResponse()
  const handledResponseId = useRef<string | null>(null)

  useEffect(() => {
    if (!PUSH_AVAILABLE || !userId) return
    registerDevice().catch(() => {
      // Push is a convenience — no permission, no credentials or no network must never break
      // the app. The next sign-in or launch tries again.
    })
  }, [userId])

  useEffect(() => {
    if (!PUSH_AVAILABLE || !userId || !lastResponse) return
    const id = lastResponse.notification.request.identifier
    if (handledResponseId.current === id) return
    handledResponseId.current = id
    const orderId = lastResponse.notification.request.content.data?.order_id
    if (typeof orderId === 'string') onOpenOrder(orderId)
  }, [lastResponse, userId, onOpenOrder])
}
