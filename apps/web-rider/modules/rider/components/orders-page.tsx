'use client'

import Link from 'next/link'
import { Package, ChevronRight } from 'lucide-react'
import { Card, CardContent, Skeleton } from '@avdan/ui'

import { useRiderOrders } from '../hooks/use-rider-orders'
import { ROUTES } from '@/config/routes'
import { formatKobo } from '@/lib/format'

const STATUS_COLORS: Record<string, string> = {
  READY_FOR_PICKUP: 'bg-blue-100 text-blue-800',
  PICKED_UP: 'bg-purple-100 text-purple-800',
  IN_TRANSIT_TO_HUB: 'bg-orange-100 text-orange-800',
  QA_PASSED: 'bg-green-100 text-green-800',
  OUT_FOR_DELIVERY: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-green-100 text-green-800',
  FAILED_DELIVERY: 'bg-red-100 text-red-800',
}

export function OrdersPage() {
  const { data: orders, isLoading } = useRiderOrders()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-4 py-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!orders?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <Package className="h-12 w-12 text-muted-foreground/40" />
        <p className="font-medium">No orders yet</p>
        <p className="text-sm text-muted-foreground">Assigned orders will appear here</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 py-6">
      <h1 className="text-lg font-semibold">My Orders</h1>
      {orders.map((order) => (
        <Link key={order.id} href={ROUTES.order(order.id)}>
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Order #{order.id.slice(-8).toUpperCase()}</p>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? 'bg-muted text-muted-foreground'}`}
                >
                  {order.status.replace(/_/g, ' ')}
                </span>
                <p className="text-xs text-muted-foreground">{formatKobo(order.total_kobo)}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
