/**
 * Road-snapped routes for the live maps, fetched from OUR API (`GET /routing/route`), never from a
 * routing service directly: the API holds any provider setting, caches answers and rate-limits.
 *
 * Callers MUST treat `null` as normal (routing not configured, provider down, no road link, not
 * signed in) and fall back to a straight line: a map must never go blank or show an error because
 * the route line is missing.
 */
import { apiClient } from './api-client'

export interface RoutePoint {
  lat: number
  lng: number
}

export interface RoadRoute {
  points: RoutePoint[]
  distanceM: number
  durationS: number
}

interface RouteApiResponse {
  distance_m: number
  duration_s: number
  points: RoutePoint[]
}

export async function fetchRoadRouteDetails(origin: RoutePoint, destination: RoutePoint): Promise<RoadRoute | null> {
  try {
    const res = await apiClient.get<RouteApiResponse>('/routing/route', {
      from_lat: String(origin.lat),
      from_lng: String(origin.lng),
      to_lat: String(destination.lat),
      to_lng: String(destination.lng),
    })
    if (!res.points || res.points.length < 2) return null
    return { points: res.points, distanceM: res.distance_m, durationS: res.duration_s }
  } catch {
    return null
  }
}

/** Just the points, for callers that only draw the line. */
export async function fetchRoadRoute(origin: RoutePoint, destination: RoutePoint): Promise<RoutePoint[] | null> {
  return (await fetchRoadRouteDetails(origin, destination))?.points ?? null
}

/** Great-circle distance in km, used for captions and to decide when to refetch. */
export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Minimum movement (km) since the last fetched route before it is worth fetching again. */
export const REFETCH_DISTANCE_KM = 0.2
