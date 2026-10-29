'use client'

import { useEffect, useRef, useState } from 'react'

export interface LiveLocation {
  lat: number
  lng: number
}

export type LiveLocationStatus = 'idle' | 'watching' | 'denied' | 'unsupported'

/**
 * Watches the rider's own live position for the in-browser live map — separate from
 * `useLocationBroadcast`, which also calls `watchPosition` but only to POST the coordinate to
 * dispatch and never exposes it back to a component. Mirrors that hook's `navigator.geolocation`
 * usage (same options) rather than inventing a different permission flow; the browser only ever
 * prompts once per origin regardless of how many `watchPosition` calls are active, so this does
 * not cause a second permission prompt.
 */
export function useLiveLocation(enabled: boolean): { location: LiveLocation | null; status: LiveLocationStatus } {
  const [location, setLocation] = useState<LiveLocation | null>(null)
  const [status, setStatus] = useState<LiveLocationStatus>('idle')
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLocation(null)
      setStatus('idle')
      return
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported')
      return
    }

    setStatus('watching')
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus('denied')
      },
      { enableHighAccuracy: true, maximumAge: 3000 },
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [enabled])

  return { location, status }
}
