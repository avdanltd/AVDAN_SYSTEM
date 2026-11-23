import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline, type Region } from 'react-native-maps'
import { Bike, MapPin } from 'lucide-react-native'
import { MAPS_AVAILABLE, REFETCH_DISTANCE_KM, fetchRoadRoute, haversineKm, radius, spacing, useTheme, type RoutePoint } from '@avdan/mobile'

const MAP_HEIGHT = 220
const PADDING = 1.8
const MIN_DELTA = 0.012

const STAGE_TEXT: Record<string, string> = {
  to_vendor: 'Your rider is heading to the seller to collect your order',
  to_hub: 'Your order is on its way to our quality-check hub',
  at_hub: 'Your order is at our hub for a quality check',
  to_customer: 'Your rider is on the way to you',
}

function region(a: RoutePoint, b: RoutePoint | null): Region {
  if (!b) return { latitude: a.lat, longitude: a.lng, latitudeDelta: MIN_DELTA * 2, longitudeDelta: MIN_DELTA * 2 }
  return {
    latitude: (a.lat + b.lat) / 2,
    longitude: (a.lng + b.lng) / 2,
    latitudeDelta: Math.max(Math.abs(a.lat - b.lat) * PADDING, MIN_DELTA),
    longitudeDelta: Math.max(Math.abs(a.lng - b.lng) * PADDING, MIN_DELTA),
  }
}

/**
 * The rider's live position on a map, with the customer's delivery point and, for the last leg, the
 * road route between them. Phones without a map (an Android build with no key) render nothing and
 * the order screen keeps its "View rider location" button. iPhones use Apple Maps (no key needed).
 * The route line is a bonus: if it cannot be fetched the map still works, with no line.
 */
export function TrackingMap({
  rider,
  destination,
  stage,
  etaSeconds,
}: {
  rider: RoutePoint
  destination: RoutePoint | null
  stage: string | null
  etaSeconds: number | null
}) {
  const { colors } = useTheme()
  const [route, setRoute] = useState<RoutePoint[] | null>(null)
  const last = useRef<RoutePoint | null>(null)
  const request = useRef(0)
  const lastLeg = stage === 'to_customer' && destination !== null

  useEffect(() => {
    if (!lastLeg || !destination) {
      setRoute(null)
      last.current = null
      return
    }
    if (last.current && haversineKm(last.current, rider) < REFETCH_DISTANCE_KM) return
    last.current = rider
    const id = ++request.current
    void fetchRoadRoute(rider, destination).then((points) => {
      if (id === request.current) setRoute(points)
    })
  }, [rider, destination, lastLeg])

  const view = useMemo(() => region(rider, destination), [rider, destination])
  if (!MAPS_AVAILABLE) return null

  const eta = etaSeconds != null && etaSeconds > 0 ? `About ${Math.max(1, Math.round(etaSeconds / 60))} min away` : null
  const caption = [stage ? STAGE_TEXT[stage] : null, lastLeg ? eta : null].filter(Boolean).join(' · ')

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <MapView style={styles.map} region={view} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false}>
          <Marker coordinate={{ latitude: rider.lat, longitude: rider.lng }} title="Your rider" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.rider, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]}>
              <Bike size={14} color={colors.primaryForeground} />
            </View>
          </Marker>
          {destination ? (
            <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title="Delivery address">
              <View style={[styles.pin, { backgroundColor: colors.accent, borderColor: colors.accentForeground }]}>
                <MapPin size={12} color={colors.accentForeground} />
              </View>
            </Marker>
          ) : null}
          {route ? (
            <Polyline coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={colors.primary} strokeWidth={3} />
          ) : null}
        </MapView>
      </View>
      {caption ? <Text style={[styles.caption, { color: colors.mutedForeground }]}>{caption}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  card: { height: MAP_HEIGHT, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1 },
  map: { flex: 1 },
  rider: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  pin: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 12.5, lineHeight: 17 },
})
