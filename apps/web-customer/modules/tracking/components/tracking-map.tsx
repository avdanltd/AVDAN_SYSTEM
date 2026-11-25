'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { fetchRoadRoute, haversineKm, REFETCH_DISTANCE_KM, type RoutePoint } from '../lib/road-route'

// Use a custom div icon to avoid the webpack asset issue with leaflet default markers
function createRiderIcon() {
  return L.divIcon({
    html: `<div style="background:#0ea5e9;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

function destinationIcon() {
  return L.divIcon({
    html: `<div style="background:#f59f0a;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  })
}

interface TrackingMapProps {
  lat: number
  lng: number
  riderName?: string
  /** The customer's delivery point; with `lastLeg` the road route to it is drawn. */
  destination?: RoutePoint | null
  lastLeg?: boolean
}

export function TrackingMap({ lat, lng, riderName, destination, lastLeg }: TrackingMapProps) {
  const [route, setRoute] = useState<RoutePoint[] | null>(null)
  const last = useRef<RoutePoint | null>(null)
  const request = useRef(0)

  useEffect(() => {
    if (!lastLeg || !destination) {
      setRoute(null)
      last.current = null
      return
    }
    const rider = { lat, lng }
    if (last.current && haversineKm(last.current, rider) < REFETCH_DISTANCE_KM) return
    last.current = rider
    const id = ++request.current
    void fetchRoadRoute(rider, destination).then((points) => {
      if (id === request.current) setRoute(points)
    })
  }, [lat, lng, destination, lastLeg])

  return (
    <div className="relative h-[400px] w-full overflow-hidden rounded-xl border border-border">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={createRiderIcon()}>
          <Popup>
            {riderName ? `Rider: ${riderName}` : 'Rider location'}
          </Popup>
        </Marker>
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon()}>
            <Popup>Delivery address</Popup>
          </Marker>
        )}
        {route && <Polyline positions={route.map((p): [number, number] => [p.lat, p.lng])} pathOptions={{ color: '#0ea5e9', weight: 4 }} />}
      </MapContainer>
    </div>
  )
}
