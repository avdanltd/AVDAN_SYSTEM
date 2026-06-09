'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  OrderStatusBadge,
  Skeleton,
  EmptyState,
  Badge,
} from '@avdan/ui'
import { ArrowLeft, Clock, MapPin, Truck, User } from 'lucide-react'
import { useOrder } from '@/modules/orders/hooks/use-order'
import { useOrderTracking } from '../hooks/use-order-tracking'
import { ROUTES } from '@/config/routes'

// Dynamic import with ssr:false — Leaflet requires browser APIs
const TrackingMap = dynamic(
  () => import('./tracking-map').then((m) => m.TrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-border bg-muted">
        <div className="text-center text-muted-foreground">
          <MapPin className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Loading map…</p>
        </div>
      </div>
    ),
  },
)

export function TrackingPage({ id }: { id: string }) {
  const { data: order, isLoading: orderLoading } = useOrder(id)
  const tracking = useOrderTracking(id)

  if (orderLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        description="Could not load tracking information."
        action={{ label: 'Back to orders', onClick: () => window.history.back() }}
        icon={<Truck className="h-6 w-6" />}
      />
    )
  }

  const hasLocation = tracking.location !== null

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href={ROUTES.order(id)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to order
      </Link>

      {/* Status banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div>
          <p className="text-sm text-muted-foreground">Current Status</p>
          <div className="mt-1.5 flex items-center gap-3">
            <OrderStatusBadge status={tracking.status ?? order.status} />
            {tracking.connected && (
              <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-200 bg-green-50">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Live
              </Badge>
            )}
          </div>
        </div>
        {tracking.eta && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">ETA:</span>
            <span className="font-semibold text-foreground">{tracking.eta}</span>
          </div>
        )}
      </div>

      {/* Map */}
      {hasLocation ? (
        <TrackingMap
          lat={tracking.location!.lat}
          lng={tracking.location!.lng}
          riderName={tracking.rider?.name}
        />
      ) : (
        <div className="flex h-[400px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground opacity-40" />
          <div>
            <p className="font-medium text-foreground">Location not yet available</p>
            <p className="text-sm text-muted-foreground">
              The map will update automatically once the rider is assigned.
            </p>
          </div>
        </div>
      )}

      {/* Rider info */}
      {tracking.rider && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Your Rider
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{tracking.rider.name}</p>
              <p className="text-sm text-muted-foreground">{tracking.rider.phone}</p>
            </div>
            <a
              href={`tel:${tracking.rider.phone}`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
            >
              Call Rider
            </a>
          </CardContent>
        </Card>
      )}

      {/* Order summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order #{order.id.slice(0, 8).toUpperCase()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {order.items && order.items.length > 0 ? (
            <ul className="list-inside list-disc space-y-0.5">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.name} × {item.quantity}
                </li>
              ))}
            </ul>
          ) : (
            <p>Order details loading…</p>
          )}
          <p className="pt-2 font-semibold text-foreground">
            Total: {(order.total_kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
