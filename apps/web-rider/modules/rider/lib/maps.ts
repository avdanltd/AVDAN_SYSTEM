import type { RiderOrder } from '../types'

/** Google Maps link for the customer's location (free — a plain link, no API key). Uses the exact
 * pin the customer shared at checkout when there is one, otherwise the written address. */
export function mapsUrl(address: RiderOrder['delivery_address']): string {
  const { lat, lng } = address as { lat?: unknown; lng?: unknown }
  const query =
    typeof lat === 'number' && typeof lng === 'number'
      ? `${lat},${lng}`
      : encodeURIComponent(
          [address.street, address.city, address.lga, address.state].filter(Boolean).join(', '),
        )
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}
