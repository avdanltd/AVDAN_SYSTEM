'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  OrderStatusBadge,
  Separator,
  Skeleton,
  EmptyState,
  toast,
} from '@avdan/ui'
import { ArrowLeft, MapPin, Package, Truck } from 'lucide-react'
import { useOrder } from '../hooks/use-order'
import { useCancelOrder } from '../hooks/use-cancel-order'
import { ROUTES } from '@/config/routes'

function formatPrice(kobo: number): string {
  return (kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const IN_TRANSIT_STATUSES = new Set([
  'PICKED_UP',
  'IN_TRANSIT_TO_HUB',
  'AT_HUB',
  'OUT_FOR_DELIVERY',
])

export function OrderDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const { data: order, isLoading, error } = useOrder(id)
  const { mutate: cancelOrder, isPending: isCancelling } = useCancelOrder(id)
  const [cancelOpen, setCancelOpen] = useState(false)

  function handleCancel() {
    cancelOrder(undefined, {
      onSuccess: () => {
        toast.success('Order cancelled successfully')
        setCancelOpen(false)
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel order')
        setCancelOpen(false)
      },
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <EmptyState
        title="Order not found"
        description="This order may no longer be available."
        action={{ label: 'Back to orders', onClick: () => router.push(ROUTES.orders) }}
        icon={<Package className="h-6 w-6" />}
      />
    )
  }

  const canCancel = order.status === 'PENDING'
  const canTrack = IN_TRANSIT_STATUSES.has(order.status)

  const address = order.delivery_address as Record<string, string>

  return (
    <>
      <div className="space-y-6">
        {/* Back nav */}
        <Link
          href={ROUTES.orders}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>

        {/* Order header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">
                Order #{order.id.slice(0, 8).toUpperCase()}
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Placed {formatDate(order.created_at)}
            </p>
          </div>
          <div className="flex gap-2">
            {canTrack && (
              <Button variant="outline" size="sm" asChild>
                <Link href={ROUTES.orderTrack(order.id)}>
                  <Truck className="mr-1.5 h-4 w-4" />
                  Track Order
                </Link>
              </Button>
            )}
            {canCancel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCancelOpen(true)}
              >
                Cancel Order
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          {/* Items */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                {order.items && order.items.length > 0 ? (
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground line-clamp-1">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(item.price_kobo)} × {item.quantity}
                          </p>
                        </div>
                        <span className="font-semibold shrink-0">
                          {formatPrice(item.price_kobo * item.quantity)}
                        </span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex items-center justify-between font-bold text-base">
                      <span>Total</span>
                      <span>{formatPrice(order.total_kobo)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No item details available.</p>
                )}
              </CardContent>
            </Card>

            {/* Status timeline */}
            {order.events && order.events.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="relative ml-2 space-y-4 border-l border-border pl-6">
                    {order.events.map((event, idx, arr) => (
                      <li key={event.id} className="relative">
                        <div className="absolute -left-[25px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background">
                          {idx === arr.length - 1 && (
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {event.from_state && (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  {event.from_state}
                                </Badge>
                                <span className="text-xs text-muted-foreground">→</span>
                              </>
                            )}
                            <Badge className="text-xs">{event.to_state}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(event.created_at)}
                            {event.actor_role && ` · by ${event.actor_role}`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Delivery info */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {address.street && <p className="font-medium">{address.street}</p>}
                {(address.city || address.state) && (
                  <p className="text-muted-foreground">
                    {[address.city, address.state].filter(Boolean).join(', ')}
                  </p>
                )}
                {address.notes && (
                  <p className="mt-2 text-xs italic text-muted-foreground">Note: {address.notes}</p>
                )}
                {order.contact_phone && (
                  <p className="mt-2 text-muted-foreground">📞 {order.contact_phone}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-mono text-xs">{order.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendor</span>
                  <span>{order.vendor_name ?? order.vendor_id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last updated</span>
                  <span className="text-xs">{formatDate(order.updated_at)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this order?"
        description="This action cannot be undone. The order will be cancelled and you will receive a refund if payment was made."
        confirmLabel="Yes, cancel order"
        cancelLabel="Keep order"
        destructive
        loading={isCancelling}
        onConfirm={handleCancel}
      />
    </>
  )
}
