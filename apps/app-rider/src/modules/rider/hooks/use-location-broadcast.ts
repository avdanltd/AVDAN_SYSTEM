import { useEffect, useRef } from 'react'
import * as Location from 'expo-location'

import { LOCATION_TASK_NAME } from '@/tasks/location-task'
import { riderService } from '../services/rider.service'

const BROADCAST_INTERVAL_MS = 5000
const MIN_DISTANCE_METERS = 25

// Background location (expo-task-manager + a foreground service) requires custom
// Info.plist/AndroidManifest entries baked into a real native build (EAS dev client).
// Expo Go is a shared, precompiled binary and cannot provide those — attempting
// background permissions there throws. We try the full background-capable path
// first (works once this ships as a real build) and fall back to foreground-only
// watchPositionAsync (works in Expo Go) if it's unavailable.
export function useLocationBroadcast(isOnline: boolean) {
  const foregroundSubscription = useRef<Location.LocationSubscription | null>(null)

  useEffect(() => {
    let cancelled = false

    async function startForegroundFallback() {
      if (foregroundSubscription.current) return
      foregroundSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: BROADCAST_INTERVAL_MS,
          distanceInterval: MIN_DISTANCE_METERS,
        },
        (position) => {
          riderService
            .broadcastLocation(position.coords.latitude, position.coords.longitude)
            .catch(() => {})
        },
      )
    }

    function stopForegroundFallback() {
      foregroundSubscription.current?.remove()
      foregroundSubscription.current = null
    }

    async function start() {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync()
      if (fgStatus !== 'granted' || cancelled) return

      try {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync()
        if (bgStatus !== 'granted') throw new Error('Background permission not granted')

        const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
        if (!alreadyRunning && !cancelled) {
          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.High,
            timeInterval: BROADCAST_INTERVAL_MS,
            distanceInterval: MIN_DISTANCE_METERS,
            foregroundService: {
              notificationTitle: 'AVDAN Rider',
              notificationBody: 'Broadcasting your location while online',
            },
          })
        }
      } catch {
        // Not available (e.g. running in Expo Go) — fall back to foreground-only.
        if (!cancelled) await startForegroundFallback()
      }
    }

    async function stop() {
      stopForegroundFallback()
      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
        () => false,
      )
      if (alreadyRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
      }
    }

    if (isOnline) {
      start()
    } else {
      stop()
    }

    return () => {
      cancelled = true
      stopForegroundFallback()
    }
  }, [isOnline])
}
