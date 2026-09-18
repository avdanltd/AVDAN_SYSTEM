/**
 * Road-snapped route fetching via OSRM's public demo server.
 *
 * IMPORTANT — PROTOTYPE ONLY, NOT PRODUCTION-SAFE:
 * `router.project-osrm.org` is a free demo instance run by the OSRM project for evaluation/
 * testing. It has no uptime SLA, no documented rate limits (it will silently throttle or block
 * a user-agent/IP that sends too much traffic), and can be taken down or changed without notice.
 * It must NEVER be treated as this app's production routing backend. Before shipping this to
 * real riders, replace this module with one of:
 *   - A self-hosted OSRM instance (same API, our own infra, our own rate limits)
 *   - Mapbox Directions API (paid, has a JS SDK, adds live traffic + turn-by-turn if needed)
 *   - Google Directions API / Navigation SDK (paid, partner access required for nav SDK)
 *   - HERE Routing API (paid)
 *
 * This module exists to prove the "real road-shaped polyline" feature today, with a public
 * server that needs no API key or signup. Callers MUST treat a `null` result as expected and
 * fall back to a straight line — never surface an error or blank map when this fails.
 */

const OSRM_BASE_URL = 'https://router.project-osrm.org'
const REQUEST_TIMEOUT_MS = 5000

export interface RoutePoint {
  lat: number
  lng: number
}

interface OsrmResponse {
  code: string
  routes?: { geometry?: { coordinates?: [number, number][] } }[]
}

/**
 * Fetches a road-following route between two points from OSRM's demo server.
 * Returns the ordered list of {lat, lng} points tracing the route, or `null` if the request
 * fails for any reason (network error, timeout, non-200, malformed response, rate limiting).
 * Never throws — callers can rely on `null` meaning "fall back to the straight line".
 */
export async function fetchRoadRoute(origin: RoutePoint, destination: RoutePoint): Promise<RoutePoint[] | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson`

    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null

    const data = (await response.json()) as OsrmResponse
    const coordinates = data.routes?.[0]?.geometry?.coordinates
    if (!coordinates || coordinates.length < 2) return null

    return coordinates.map(([lng, lat]) => ({ lat, lng }))
  } catch {
    // Network error, abort/timeout, or malformed JSON — treat all the same: no route available.
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Great-circle distance in km, used both for the caption and to decide when to refetch. */
export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Minimum rider movement (km) since the last fetched route before we bother refetching. */
export const REFETCH_DISTANCE_KM = 0.08
