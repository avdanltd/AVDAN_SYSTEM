'use client'

import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, PackageCheck } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  OrderStatusBadge,
  Skeleton,
  Separator,
  Badge,
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { formatKobo, formatDate } from '@/lib/format'
import { useHubOrder } from '../hooks/use-hub-order'
import { useReceiveOrder } from '../hooks/use-receive-order'

interface OrderDetailPageProps {
  orderId: string
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const { data: order, isLoading, error } = useHubOrder(orderId)
  const { mutate: receiveOrder, isPending: receiving } = useReceiveOrder()

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <p className="text-sm text-destructive">
          Order not found or failed to load.
        </p>
        <Link href={ROUTES.orders} className="mt-3 inline-block">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Orders
          </Button>
        </Link>
      </div>
    )
  }

  const shortId = order.id.slice(0, 8).toUpperCase()
  const canReceive = order.status === 'IN_TRANSIT_TO_HUB'
  const canQa = order.status === 'QA_IN_PROGRESS'

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back + header */}
      <div>
        <Link href={ROUTES.orders}>
          <Button variant="ghost" size="sm" className="-ml-2 mb-3 h-9">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Orders
          </Button>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-xl font-bold text-foreground">Order #{shortId}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-2">
            {canReceive && (
              <Button
                size="sm"
                className="gap-2"
                disabled={receiving}
                onClick={() => receiveOrder(order.id)}
              >
                <PackageCheck className="h-4 w-4" />
                {receiving ? 'Receiving…' : 'Receive Order'}
              </Button>
            )}
            {canQa && (
              <Link href={ROUTES.orderQa(order.id)}>
                <Button size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                  <ClipboardCheck className="h-4 w-4" />
                  Start QA
                </Button>
              </Link>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {order.vendor_name && `Vendor: ${order.vendor_name} · `}
          Created {formatDate(order.created_at)}
        </p>
      </div>

      {/* Order details */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Order Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">Order ID</dt>
              <dd className="font-mono text-sm font-medium text-foreground">{order.id}</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd><OrderStatusBadge status={order.status} /></dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">Vendor</dt>
              <dd className="text-sm font-medium text-foreground">{order.vendor_name ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">Total</dt>
              <dd className="text-sm font-bold text-foreground">{formatKobo(order.total_kobo)}</dd>
            </div>
            {order.arrived_at && (
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Arrived at Hub</dt>
                <dd className="text-sm text-foreground">{formatDate(order.arrived_at)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Items ({order.items.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="shrink-0">
                      ×{item.quantity}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{item.product_name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatKobo(item.price_kobo)}
                  </span>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-base font-bold">{formatKobo(order.total_kobo)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
