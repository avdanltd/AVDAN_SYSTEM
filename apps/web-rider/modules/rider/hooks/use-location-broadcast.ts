'use client'

import { useEffect, useRef } from 'react'
import { riderService } from '../services/rider.service'

const BROADCAST_INTERVAL_MS = 5000

export function useLocationBroadcast(isOnline: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const latestPosition = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!isOnline || typeof navigator === 'undefined' || !navigator.geolocation) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        latestPosition.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 },
    )

    intervalRef.current = setInterval(() => {
      if (latestPosition.current) {
        riderService
          .broadcastLocation(latestPosition.current.lat, latestPosition.current.lng)
          .catch(() => {})
      }
    }, BROADCAST_INTERVAL_MS)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isOnline])
}
