import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import MapView, { Marker, Polyline, type Region } from 'react-native-maps'
import { Navigation2 } from 'lucide-react-native'

import { radius, spacing, useTheme } from '@avdan/mobile'
import type { LiveLocation } from '../hooks/use-live-location'
import { fetchRoadRoute, haversineKm, REFETCH_DISTANCE_KM, type RoutePoint } from '../lib/road-route'

interface DeliveryMapProps {
  rider: LiveLocation | null
  destination: { lat: number; lng: number; label: string } | null
}

const MAP_HEIGHT = 200
// Padding around the two points so neither marker sits flush against the card edge.
const REGION_PADDING_FACTOR = 1.8
const MIN_DELTA = 0.01
// Android's Google Maps SDK needs an API key baked into the manifest at build time and throws
// when one is missing; iOS uses Apple Maps and needs none. Expo Go ships its own key, so this
// only ever disables the map in an Android build made without GOOGLE_MAPS_API_KEY_ANDROID.
const MAP_AVAILABLE =
  Platform.OS !== 'android' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.expoConfig?.extra?.hasAndroidMapsKey === true

function regionFor(rider: LiveLocation, destination: { lat: number; lng: number }): Region {
  const latitude = (rider.lat + destination.lat) / 2
  const longitude = (rider.lng + destination.lng) / 2
  const latitudeDelta = Math.max(Math.abs(rider.lat - destination.lat) * REGION_PADDING_FACTOR, MIN_DELTA)
  const longitudeDelta = Math.max(Math.abs(rider.lng - destination.lng) * REGION_PADDING_FACTOR, MIN_DELTA)
  return { latitude, longitude, latitudeDelta, longitudeDelta }
}

/**
 * A live-position map: the rider's own GPS dot, a marker for the current destination (hub or
 * customer, decided by the caller), and a route line between them. When possible the line is a
 * real road-snapped route fetched from OSRM's public demo server (see `../lib/road-route.ts` —
 * that server is a best-effort prototype dependency, NOT production-safe); if that fetch fails,
 * is slow, or hasn't resolved yet, this falls back to a dashed straight-line distance/direction
 * indicator so the map is never broken or blank. The region recalculates (and the map recenters)
 * every time the rider's coordinate updates, so it follows the rider as they move. The existing
 * "Navigate" button (openInMaps/openCoordsInMaps) stays the way to get real turn-by-turn
 * directions via the phone's native Maps app.
 */
export function DeliveryMap({ rider, destination }: DeliveryMapProps) {
  const { colors } = useTheme()

  const [routePoints, setRoutePoints] = useState<RoutePoint[] | null>(null)
  const lastFetchRef = useRef<{ rider: RoutePoint; destination: RoutePoint } | null>(null)
  const requestIdRef = useRef(0)

  const region = useMemo(() => {
    if (!rider || !destination) return null
    return regionFor(rider, destination)
  }, [rider, destination])

  const distanceKm = useMemo(() => {
    if (!rider || !destination) return null
    return haversineKm(rider, destination)
  }, [rider, destination])

  useEffect(() => {
    if (!rider || !destination) {
      setRoutePoints(null)
      lastFetchRef.current = null
      return
    }

    const last = lastFetchRef.current
    const destinationChanged = !last || last.destination.lat !== destination.lat || last.destination.lng !== destination.lng
    const movedEnough = !last || haversineKm(last.rider, rider) >= REFETCH_DISTANCE_KM

    if (!destinationChanged && !movedEnough) return

    const requestId = ++requestIdRef.current
    lastFetchRef.current = { rider, destination }

    fetchRoadRoute(rider, destination).then((points) => {
      // Ignore stale responses from a superseded request (e.g. destination changed mid-flight).
      if (requestId !== requestIdRef.current) return
      setRoutePoints(points)
    })
  }, [rider, destination])

  if (!destination) return null

  if (!rider || !region) {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
          Waiting for your location to show the live map…
        </Text>
      </View>
    )
  }

  if (!MAP_AVAILABLE) {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
          {distanceKm != null ? `${distanceKm.toFixed(1)} km away (straight line). ` : ''}
          Live map unavailable in this build — use Navigate for directions.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapCard, { borderColor: colors.border }]}>
        <MapView
          style={styles.map}
          region={region}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        >
          <Marker coordinate={{ latitude: rider.lat, longitude: rider.lng }} title="You" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.riderDot, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]} />
          </Marker>
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title={destination.label}
          >
            <View style={[styles.destPin, { backgroundColor: colors.accent, borderColor: colors.accentForeground }]}>
              <Navigation2 size={12} color={colors.accentForeground} />
            </View>
          </Marker>
          <Polyline
            coordinates={
              routePoints
                ? routePoints.map((p) => ({ latitude: p.lat, longitude: p.lng }))
                : [
                    { latitude: rider.lat, longitude: rider.lng },
                    { latitude: destination.lat, longitude: destination.lng },
                  ]
            }
            strokeColor={colors.primary}
            strokeWidth={2.5}
            lineDashPattern={routePoints ? undefined : [8, 6]}
          />
        </MapView>
      </View>
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>
        {distanceKm != null
          ? routePoints
            ? `${distanceKm.toFixed(1)} km · route may not reflect real-time traffic`
            : `${distanceKm.toFixed(1)} km away (straight line, not a route)`
          : null}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  mapCard: {
    height: MAP_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  map: { flex: 1 },
  placeholder: {
    height: MAP_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  placeholderText: { fontSize: 13, textAlign: 'center' },
  riderDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  destPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { fontSize: 11.5, textAlign: 'center' },
})
