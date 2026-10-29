'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

import { fetchRoadRoute, haversineKm, REFETCH_DISTANCE_KM, type RoutePoint } from '../lib/road-route'

// Custom div icons (same technique as web-customer's tracking-map.tsx) to avoid the webpack
// asset-resolution issue with Leaflet's default marker images.
function riderIcon() {
  return L.divIcon({
    html: `<div style="background:#135bec;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function destinationIcon() {
  return L.divIcon({
    html: `<div style="background:#f59f0a;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

interface DeliveryMapProps {
  rider: { lat: number; lng: number } | null
  destination: { lat: number; lng: number; label: string }
}

/** Recenters the map whenever the rider's coordinate changes, so it follows the rider live. */
function FollowRider({ rider }: { rider: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (rider) map.panTo([rider.lat, rider.lng])
  }, [rider, map])
  return null
}

/**
 * Live map for the web rider portal: the rider's own GPS position, a marker for the current
 * destination (hub or customer — decided by the caller using the same reveal logic as the rest
 * of this app), and a route line between them. When possible the line is a real road-snapped
 * route fetched from OSRM's public demo server (see `../lib/road-route.ts` — that server is a
 * best-effort prototype dependency, NOT production-safe); if that fetch fails, is slow, or
 * hasn't resolved yet, this falls back to a dashed straight-line distance/direction indicator so
 * the map is never broken or blank. The existing "Open in Maps" link stays the way to get real
 * turn-by-turn directions.
 */
export function DeliveryMap({ rider, destination }: DeliveryMapProps) {
  const center: [number, number] = rider ? [rider.lat, rider.lng] : [destination.lat, destination.lng]

  const [routePoints, setRoutePoints] = useState<RoutePoint[] | null>(null)
  const lastFetchRef = useRef<{ rider: RoutePoint; destination: RoutePoint } | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!rider) {
      setRoutePoints(null)
      lastFetchRef.current = null
      return
    }

    const last = lastFetchRef.current
    const destinationChanged =
      !last || last.destination.lat !== destination.lat || last.destination.lng !== destination.lng
    const movedEnough = !last || haversineKm(last.rider, rider) >= REFETCH_DISTANCE_KM

    if (!destinationChanged && !movedEnough) return

    const requestId = ++requestIdRef.current
    lastFetchRef.current = { rider, destination }

    fetchRoadRoute(rider, destination).then((points) => {
      // Ignore stale responses from a superseded request (e.g. destination changed mid-flight).
      if (requestId !== requestIdRef.current) return
      setRoutePoints(points)
    })
    // destination is a plain object recreated per render by the caller — key off its coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider, destination.lat, destination.lng])

  return (
    <div className="relative h-[260px] w-full overflow-hidden rounded-xl border border-border">
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {rider && <FollowRider rider={rider} />}
        {rider && (
          <Marker position={[rider.lat, rider.lng]} icon={riderIcon()}>
            <Popup>You</Popup>
          </Marker>
        )}
        <Marker position={[destination.lat, destination.lng]} icon={destinationIcon()}>
          <Popup>{destination.label}</Popup>
        </Marker>
        {rider && (
          <Polyline
            positions={
              routePoints
                ? routePoints.map((p): [number, number] => [p.lat, p.lng])
                : [
                    [rider.lat, rider.lng],
                    [destination.lat, destination.lng],
                  ]
            }
            // NOTE: Leaflet's setStyle() merges pathOptions into the layer's existing style and
            // does not clear a property that a later render simply omits — so `dashArray` must
            // be explicitly set to `undefined` (not left out) when we have a real route, or a
            // dashed fallback line rendered earlier would stay dashed forever.
            pathOptions={
              routePoints
                ? { color: '#135bec', weight: 3.5, dashArray: undefined }
                : { color: '#135bec', weight: 2.5, dashArray: '8 6' }
            }
          />
        )}
      </MapContainer>
    </div>
  )
}
