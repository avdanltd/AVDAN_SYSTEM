import { useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'

export interface LiveLocation {
  lat: number
  lng: number
}

const WATCH_INTERVAL_MS = 4000
const MIN_DISTANCE_METERS = 10

/**
 * Watches the rider's own live GPS position for local map display (the "blue dot" on the
 * in-app live map). This is deliberately separate from `useLocationBroadcast`, which watches
 * position too but only to POST it to dispatch — that hook never exposes the coordinate back
 * to the component tree, so a second, independent watch is the only way to also render it
 * locally. Requests only foreground permission (matches what the map needs; background
 * permission is `useLocationBroadcast`'s concern and is requested there, not duplicated here).
 */
export function useLiveLocation(enabled: boolean): LiveLocation | null {
  const [location, setLocation] = useState<LiveLocation | null>(null)
  const subscription = useRef<Location.LocationSubscription | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted' || cancelled) return

      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: WATCH_INTERVAL_MS,
          distanceInterval: MIN_DISTANCE_METERS,
        },
        (position) => {
          if (cancelled) return
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        },
      )
    }

    function stop() {
      subscription.current?.remove()
      subscription.current = null
      setLocation(null)
    }

    if (enabled) {
      start()
    } else {
      stop()
    }

    return () => {
      cancelled = true
      subscription.current?.remove()
      subscription.current = null
    }
  }, [enabled])

  return location
}
