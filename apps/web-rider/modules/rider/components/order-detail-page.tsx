'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Package } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, Skeleton } from '@avdan/ui'

import { useRiderOrders } from '../hooks/use-rider-orders'
import { useOrderAction } from '../hooks/use-order-actions'
import { ORDER_ACTIONS } from '../types'
import { formatKobo } from '@/lib/format'

interface OrderDetailPageProps {
  orderId: string
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const router = useRouter()
  const { data: orders, isLoading } = useRiderOrders()
  const { execute, isPending } = useOrderAction(orderId)

  const order = orders?.find((o) => o.id === orderId)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
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
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Delivery address */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4" />
            Delivery Address
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {order.delivery_address.street && <p>{order.delivery_address.street}</p>}
          {order.delivery_address.city && <p>{order.delivery_address.city}</p>}
          {order.delivery_address.state && <p>{order.delivery_address.state}</p>}
          {!order.delivery_address.street && <p>Address not specified</p>}
        </CardContent>
      </Card>

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
            <span>Total</span>
            <span>{formatKobo(order.total_kobo)}</span>
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
