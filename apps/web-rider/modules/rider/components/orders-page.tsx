'use client'

import Link from 'next/link'
import { Package, ChevronRight, AlertCircle, History } from 'lucide-react'
import {
  Card,
  CardContent,
  Skeleton,
  OrderStatusBadge,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@avdan/ui'

import { useRiderOrders, useRiderOrderHistory } from '../hooks/use-rider-orders'
import { ROUTES } from '@/config/routes'
import { formatKobo } from '@/lib/format'
import type { RiderOrder } from '../types'

function OrderCardSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  )
}

function OrderRow({ order }: { order: RiderOrder }) {
  return (
    <Link href={ROUTES.order(order.id)}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Order #{order.id.slice(-8).toUpperCase()}</p>
            <OrderStatusBadge status={order.status} />
            <p className="text-xs text-muted-foreground">
              {formatKobo(order.delivery_fee_kobo)} you earn
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}

export function OrdersPage() {
  const active = useRiderOrders()
  const history = useRiderOrderHistory()

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-lg font-semibold">My Orders</h1>

      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Active{typeof active.data?.length === 'number' ? ` (${active.data.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="history">
            History{typeof history.data?.length === 'number' ? ` (${history.data.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-3">
          {active.isLoading ? (
            <OrderCardSkeletons />
          ) : active.isError ? (
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="Couldn't load your orders"
              description="Something went wrong fetching your orders. Check your connection and try again."
              action={{ label: 'Retry', onClick: () => active.refetch() }}
            />
          ) : !active.data?.length ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No active orders"
              description="Orders assigned to you will appear here. Go online from Home to start receiving them."
            />
          ) : (
            active.data.map((order) => <OrderRow key={order.id} order={order} />)
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {history.isLoading ? (
            <OrderCardSkeletons />
          ) : history.isError ? (
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="Couldn't load order history"
              description="Something went wrong fetching your order history. Check your connection and try again."
              action={{ label: 'Retry', onClick: () => history.refetch() }}
            />
          ) : !history.data?.length ? (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="No completed orders yet"
              description="Deliveries you finish will be kept here so you can look them up later."
            />
          ) : (
            history.data.map((order) => <OrderRow key={order.id} order={order} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
