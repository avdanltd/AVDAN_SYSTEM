'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { MapPin, Package, ChevronRight, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Switch, Spinner, EmptyState, OrderStatusBadge } from '@avdan/ui'

import { useAvailability, useRiderProfile } from '../hooks/use-availability'
import { useRiderOrders } from '../hooks/use-rider-orders'
import { useLocationBroadcast } from '../hooks/use-location-broadcast'
import { useLiveLocation } from '../hooks/use-live-location'
import { useSession } from '@/modules/auth/hooks/use-session'
import { ROUTES } from '@/config/routes'
import { formatKobo } from '@/lib/format'
import { ORDER_ACTIONS } from '../types'

// Dynamic import with ssr:false — Leaflet requires browser APIs, same pattern as
// web-customer's tracking-page.tsx.
const DeliveryMap = dynamic(() => import('./delivery-map').then((m) => m.DeliveryMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center rounded-xl border border-border bg-muted">
      <p className="text-sm text-muted-foreground">Loading map…</p>
    </div>
  ),
})

const ACTIVE_STATUSES = new Set(['READY_FOR_PICKUP', 'PICKED_UP', 'QA_PASSED', 'OUT_FOR_DELIVERY'])

export function DashboardPage() {
  const { user } = useSession()
  // Sourced from the server, not local-only state — a page reload used to always show
  // "Offline" regardless of the rider's actual availability, since nothing here ever fetched
  // `/dispatch/me`. That silently disagreed with the mobile app and dispatch's own record.
  const { data: profile } = useRiderProfile()
  const isOnline = profile?.online ?? false
  const { mutate: toggleAvailability, isPending: isToggling } = useAvailability()
  const { data: orders, isLoading, isError, refetch } = useRiderOrders()

  useLocationBroadcast(isOnline)

  const activeOrders = orders?.filter((o) => ACTIVE_STATUSES.has(o.status)) ?? []
  const activeOrder = activeOrders[0]

  // The hub always has coordinates (hub_lat/hub_lng); `delivery_address` never does — it's
  // street/city/state text only, so there is nothing to plot on a map once it's revealed. The
  // live map therefore only ever covers the to-hub leg; the existing "Open in Maps"-style link
  // still works post-reveal because the phone/browser Maps app geocodes the text address itself.
  const hasDeliveryAddress = !!activeOrder?.delivery_address.street
  const mapDestination =
    isOnline && activeOrder && !hasDeliveryAddress && activeOrder.hub_lat != null && activeOrder.hub_lng != null
      ? { lat: activeOrder.hub_lat, lng: activeOrder.hub_lng, label: activeOrder.hub_name ?? 'Drop-off hub' }
      : null
  const { location: riderLocation, status: locationStatus } = useLiveLocation(mapDestination !== null)

  const handleToggle = (value: boolean) => {
    toggleAvailability(value)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      {/* Online toggle */}
      <Card className={isOnline ? 'border-success bg-success-muted' : 'border-border'}>
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="h-6 w-6 text-success" />
            ) : (
              <WifiOff className="h-6 w-6 text-muted-foreground" />
            )}
            <div>
              <p className="text-base font-semibold">{isOnline ? 'You are Online' : 'You are Offline'}</p>
              <p className="text-sm text-muted-foreground">
                {isOnline ? 'GPS broadcasting active' : 'Toggle to start receiving orders'}
              </p>
            </div>
          </div>
          {isToggling ? (
            <Spinner size="sm" />
          ) : (
            <Switch checked={isOnline} onCheckedChange={handleToggle} aria-label="Go online" />
          )}
        </CardContent>
      </Card>

      {/* Active order */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-10">
            <Spinner />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="Couldn't load your deliveries"
              description="Something went wrong fetching your orders."
              action={{ label: 'Retry', onClick: () => refetch() }}
            />
          </CardContent>
        </Card>
      ) : activeOrder ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {activeOrder.delivery_address.street ? (
                  <>
                    {activeOrder.delivery_address.street}
                    {activeOrder.delivery_address.city ? `, ${activeOrder.delivery_address.city}` : ''}
                  </>
                ) : (
                  // Not yet revealed by the API (still pre-hub-handoff) — the hub is the
                  // relevant destination until then.
                  (activeOrder.hub_name ?? 'Drop-off hub')
                )}
              </p>
            </div>

            {mapDestination && (
              <div className="space-y-1.5">
                {locationStatus === 'denied' ? (
                  <div className="flex h-[120px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">
                      Location permission denied — enable it in your browser to see the live map.
                    </p>
                  </div>
                ) : locationStatus === 'unsupported' ? null : (
                  <DeliveryMap rider={riderLocation} destination={mapDestination} />
                )}
                <p className="text-center text-xs text-muted-foreground">
                  {riderLocation
                    ? 'Route shown is a best-effort estimate — it may not reflect real-time traffic or road closures.'
                    : 'Locating you…'}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <OrderStatusBadge status={activeOrder.status} />
              <span className="text-right text-sm font-medium">
                {formatKobo(activeOrder.delivery_fee_kobo)}
                <span className="block text-xs font-normal text-muted-foreground">you earn</span>
              </span>
            </div>
            {ORDER_ACTIONS[activeOrder.status] && (
              <Link href={ROUTES.order(activeOrder.id)}>
                <Button className="w-full" size="lg">
                  Take Action <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No active orders</p>
            <p className="text-xs text-muted-foreground">
              {isOnline ? 'Waiting for assignment…' : 'Go online to receive orders'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick link */}
      <Link href={ROUTES.orders}>
        <Button variant="outline" className="w-full">
          View all orders ({orders?.length ?? 0})
        </Button>
      </Link>

      {user && (
        <p className="text-center text-xs text-muted-foreground">
          Logged in as <span className="font-medium">{user.name ?? user.email}</span>
        </p>
      )}
    </div>
  )
}
