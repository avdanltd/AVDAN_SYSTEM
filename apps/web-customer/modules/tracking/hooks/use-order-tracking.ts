'use client'

import { useEffect, useState } from 'react'
import { WsClient } from '@/lib/ws-client'
import type { OrderStatus } from '@avdan/types'

export interface TrackingLocation {
  lat: number
  lng: number
}

export interface TrackingMessage {
  type: 'location' | 'status' | 'eta' | 'rider_info'
  location?: TrackingLocation
  status?: OrderStatus
  eta?: string
  rider?: {
    name: string
    phone: string
  }
}

export interface TrackingState {
  location: TrackingLocation | null
  status: OrderStatus | null
  eta: string | null
  rider: { name: string; phone: string } | null
  connected: boolean
}

export function useOrderTracking(orderId: string) {
  const [state, setState] = useState<TrackingState>({
    location: null,
    status: null,
    eta: null,
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
            if (message.location) next.location = message.location
            break
          case 'status':
            if (message.status) next.status = message.status
            break
          case 'eta':
            if (message.eta) next.eta = message.eta
            break
          case 'rider_info':
            if (message.rider) next.rider = message.rider
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
