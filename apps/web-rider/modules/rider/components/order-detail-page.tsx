'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, MapPin, Package, AlertCircle } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, Skeleton, OrderStatusBadge, EmptyState } from '@avdan/ui'

import { useRiderOrders } from '../hooks/use-rider-orders'
import { useOrderAction } from '../hooks/use-order-actions'
import { useLiveLocation } from '../hooks/use-live-location'
import { ORDER_ACTIONS, HUB_RELEVANT_STATUSES } from '../types'
import { formatKobo } from '@/lib/format'

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

interface OrderDetailPageProps {
  orderId: string
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const router = useRouter()
  const { data: orders, isLoading, isError, refetch } = useRiderOrders()
  const { execute, isPending } = useOrderAction(orderId)

  const order = orders?.find((o) => o.id === orderId)

  // Same reasoning as dashboard-page.tsx: only the hub leg has coordinates to plot, so the
  // live watch stays off for every other leg. Called unconditionally, ahead of the early
  // returns below, per the rules of hooks.
  const hasHubCoords = !!order?.hub_id && order.hub_lat != null && order.hub_lng != null
  const hasDeliveryAddress = !!order?.delivery_address.street
  const { location: riderLocation, status: locationStatus } = useLiveLocation(hasHubCoords && !hasDeliveryAddress)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Couldn't load this order"
          description="Something went wrong. Check your connection and try again."
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Package className="h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">Order not found</p>
        <Button variant="outline" onClick={() => router.back()}>Go back</Button>
      </div>
    )
  }

  const actions = ORDER_ACTIONS[order.status] ?? []
  const showHub = !!order.hub_id && HUB_RELEVANT_STATUSES.has(order.status)

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Order #{order.id.slice(-8).toUpperCase()}</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Delivery address — the API itself withholds this until the rider has picked the order
          back up from the hub, so `order.delivery_address` is genuinely `{}` on the wire before
          then, not just hidden here. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4" />
            Delivery Address
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {order.delivery_address.street ? (
            <>
              <p>{order.delivery_address.street}</p>
              {order.delivery_address.city && <p>{order.delivery_address.city}</p>}
              {order.delivery_address.state && <p>{order.delivery_address.state}</p>}
            </>
          ) : (
            <p>Revealed once you've picked this order up from the hub.</p>
          )}
        </CardContent>
      </Card>

      {/* Hub address — shown while the hub leg is still ahead of (or in progress for) the
          rider; hidden once OUT_FOR_DELIVERY, when the delivery address above is what matters. */}
      {showHub && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              Hub
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{order.hub_name ?? 'Hub not yet assigned'}</p>
            {order.hub_lat != null && order.hub_lng != null && (
              <>
                {locationStatus === 'denied' ? (
                  <div className="flex h-[120px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">
                      Location permission denied — enable it in your browser to see the live map.
                    </p>
                  </div>
                ) : locationStatus !== 'unsupported' ? (
                  <>
                    <DeliveryMap
                      rider={riderLocation}
                      destination={{ lat: order.hub_lat, lng: order.hub_lng, label: order.hub_name ?? 'Drop-off hub' }}
                    />
                    <p className="text-center text-xs text-muted-foreground">
                      {riderLocation
                        ? 'Route shown is a best-effort estimate — it may not reflect real-time traffic or road closures.'
                        : 'Locating you…'}
                    </p>
                  </>
                ) : null}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${order.hub_lat},${order.hub_lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-medium text-primary hover:underline"
                >
                  Open in Maps
                </a>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Order items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Items ({order.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {item.product_name} × {item.quantity}
              </span>
              <span className="font-medium">{formatKobo(item.subtotal_kobo)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Order total</span>
            <span>{formatKobo(order.total_kobo)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your delivery fee</span>
            <span className="font-semibold text-success">{formatKobo(order.delivery_fee_kobo)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="space-y-2 pt-2">
          {actions.map(({ action, label, variant }) => (
            <Button
              key={action}
              variant={variant}
              size="lg"
              className="w-full"
              disabled={isPending}
              onClick={() => execute(action)}
            >
              {isPending ? 'Processing…' : label}
            </Button>
          ))}
        </div>
      )}

      {actions.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No actions available for this order status.
        </p>
      )}
    </div>
  )
}
