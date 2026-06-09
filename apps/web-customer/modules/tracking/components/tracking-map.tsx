'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

interface TrackingMapProps {
  lat: number
  lng: number
  riderName?: string
}

export function TrackingMap({ lat, lng, riderName }: TrackingMapProps) {
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
      </MapContainer>
    </div>
  )
}
