'use client'

import { Badge, EmptyState, PageLoader, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@avdan/ui'
import { useOrders } from '../hooks/use-orders'
import { OrderCard } from './order-card'
import type { VendorOrder } from '../types'
import type { OrderStatus } from '@avdan/types'

const NEW_STATUSES: OrderStatus[] = ['PAID']
const PREPARING_STATUSES: OrderStatus[] = ['VENDOR_ACCEPTED', 'PREPARING']
const READY_STATUSES: OrderStatus[] = ['READY_FOR_PICKUP']
const HISTORY_STATUSES: OrderStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'VENDOR_REJECTED',
  'DELIVERED',
  'PAYMENT_RELEASED',
  'PAYMENT_RELEASE_PENDING',
]

function filterByStatus(orders: VendorOrder[], statuses: OrderStatus[]): VendorOrder[] {
  return orders.filter((o) => statuses.includes(o.status))
}

function OrderGrid({ orders, loading, emptyTitle, emptyDescription }: {
  orders: VendorOrder[]
  loading: boolean
  emptyTitle: string
  emptyDescription: string
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className="py-16"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  )
}

export function OrdersPage() {
  const { data, isLoading, error } = useOrders()
  const orders = data?.items ?? []

  const newOrders = filterByStatus(orders, NEW_STATUSES)
  const preparingOrders = filterByStatus(orders, PREPARING_STATUSES)
  const readyOrders = filterByStatus(orders, READY_STATUSES)
  const historyOrders = filterByStatus(orders, HISTORY_STATUSES)

  if (isLoading && orders.length === 0) {
    return <PageLoader />
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load orders"
        description="There was a problem loading your orders. Please try refreshing the page."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage incoming and active orders. Refreshes every 30 seconds.
        </p>
      </div>

      <Tabs defaultValue="new">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="new" className="flex items-center gap-2">
            New
            {newOrders.length > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] rounded-full px-1.5 text-xs">
                {newOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preparing" className="flex items-center gap-2">
            Preparing
            {preparingOrders.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] rounded-full px-1.5 text-xs">
                {preparingOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ready">
            Ready
            {readyOrders.length > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] rounded-full px-1.5 bg-green-100 text-green-700 text-xs">
                {readyOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="new">
            <OrderGrid
              orders={newOrders}
              loading={isLoading}
              emptyTitle="No new orders"
              emptyDescription="New orders will appear here when customers pay. This view auto-refreshes every 30 seconds."
            />
          </TabsContent>

          <TabsContent value="preparing">
            <OrderGrid
              orders={preparingOrders}
              loading={isLoading}
              emptyTitle="Nothing preparing"
              emptyDescription="Orders you have accepted and are preparing will appear here."
            />
          </TabsContent>

          <TabsContent value="ready">
            <OrderGrid
              orders={readyOrders}
              loading={isLoading}
              emptyTitle="Nothing ready"
              emptyDescription="Orders marked ready for pickup will appear here."
            />
          </TabsContent>

          <TabsContent value="history">
            <OrderGrid
              orders={historyOrders}
              loading={isLoading}
              emptyTitle="No order history"
              emptyDescription="Completed and cancelled orders will appear here."
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
