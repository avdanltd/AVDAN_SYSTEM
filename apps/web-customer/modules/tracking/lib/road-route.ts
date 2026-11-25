/**
 * Road-snapped routes for the live map, fetched from OUR API (`GET /routing/route`), never from a
 * routing service directly. `null` is a normal answer (routing not set up, no road link, provider
 * down): callers fall back to a straight line and must never show an error or a blank map.
 */
import { apiClient } from '@/lib/api-client'

export interface RoutePoint {
  lat: number
  lng: number
}

interface RouteApiResponse {
  points: RoutePoint[]
}

export async function fetchRoadRoute(origin: RoutePoint, destination: RoutePoint): Promise<RoutePoint[] | null> {
  try {
    const res = await apiClient.get<RouteApiResponse>('/routing/route', {
      from_lat: String(origin.lat),
      from_lng: String(origin.lng),
      to_lat: String(destination.lat),
      to_lng: String(destination.lng),
    })
    return res.points && res.points.length >= 2 ? res.points : null
  } catch {
    return null
  }
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
