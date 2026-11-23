// The road route now comes from our own API (see @avdan/mobile's road-route). This file stays so the
// map component's imports do not change; the public OSRM demo server is no longer used.
export { fetchRoadRoute, haversineKm, REFETCH_DISTANCE_KM, type RoutePoint } from '@avdan/mobile'
