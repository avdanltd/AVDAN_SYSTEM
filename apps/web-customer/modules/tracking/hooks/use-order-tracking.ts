'use client'

import { useEffect, useState } from 'react'
import { WsClient } from '@/lib/ws-client'
import type { OrderStatus } from '@avdan/types'

export interface TrackingLocation {
  lat: number
  lng: number
}

// Matches the WS contract in apps/api/services/tracking/router.py exactly — the initial-state
// burst on connect and every live pub/sub push use these same three shapes.
export type TrackingMessage =
  | { type: 'status'; status: OrderStatus }
  | { type: 'location'; lat: number; lng: number; eta_seconds: number | null }
  | { type: 'rider_info'; name: string | null; phone: string | null }
  | { type: 'error'; message: string }

export interface TrackingState {
  location: TrackingLocation | null
  status: OrderStatus | null
  etaSeconds: number | null
  rider: { name: string | null; phone: string | null } | null
  connected: boolean
}

export function useOrderTracking(orderId: string) {
  const [state, setState] = useState<TrackingState>({
    location: null,
    status: null,
    etaSeconds: null,
    rider: null,
    connected: false,
  })

  useEffect(() => {
    if (!orderId) return

    const client = new WsClient()
    client.connect(`/order/${orderId}`)

    const unsubscribe = client.on((raw) => {
      const message = raw as TrackingMessage
      setState((prev) => {
        const next = { ...prev, connected: true }
        switch (message.type) {
          case 'location':
            next.location = { lat: message.lat, lng: message.lng }
            next.etaSeconds = message.eta_seconds
            break
          case 'status':
            next.status = message.status
            break
          case 'rider_info':
            next.rider = { name: message.name, phone: message.phone }
            break
          case 'error':
            break
        }
        return next
      })
    })

    return () => {
      unsubscribe()
      client.disconnect()
    }
  }, [orderId])

  return state
}
