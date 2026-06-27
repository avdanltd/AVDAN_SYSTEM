'use client'

import Link from 'next/link'
import { ShoppingBag, MapPin } from 'lucide-react'
import { OrderStatusBadge, EmptyState, Skeleton, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@avdan/ui'
import { useOrders } from '../hooks/use-orders'
import type { Order } from '../services/orders.service'
import { ROUTES } from '@/config/routes'

const ACTIVE_STATUSES = [
  'PENDING', 'PAID', 'VENDOR_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP',
  'PICKED_UP', 'IN_TRANSIT_TO_HUB', 'AT_HUB', 'QA_IN_PROGRESS', 'QA_PASSED',
  'OUT_FOR_DELIVERY',
]
const COMPLETED_STATUSES = ['DELIVERED', 'COMPLETED', 'PAYMENT_RELEASED']
const CANCELLED_STATUSES = ['CANCELLED', 'VENDOR_REJECTED', 'QA_FAILED', 'FAILED_DELIVERY', 'REFUND_INITIATED']

function formatPrice(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
}

function isActive(status: string) { return ACTIVE_STATUSES.includes(status) }
function isCompleted(status: string) { return COMPLETED_STATUSES.includes(status) }
function isCancelled(status: string) { return CANCELLED_STATUSES.includes(status) }

function OrderCard({ order }: { order: Order }) {
  const active = isActive(order.status)
  return (
    <Link
      href={ROUTES.order(order.id)}
      className="group block rounded-xl border border-border bg-background p-4 transition-all hover:border-primary/50 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 font-semibold text-foreground group-hover:text-primary transition-colors">
            {order.vendor_name ?? 'Vendor order'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold text-foreground">{formatPrice(order.total_kobo)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {active && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            asChild
            onClick={(e) => e.stopPropagation()}
          >
            <Link href={ROUTES.orderTrack(order.id)}>
              <MapPin className="h-3 w-3" />
              Track
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" asChild>
          <Link href={ROUTES.order(order.id)}>View Details →</Link>
        </Button>
      </div>
    </Link>
  )
}

function OrderList({ orders, loading, emptyTitle, emptyDesc }: {
  orders: Order[]
  loading: boolean
  emptyTitle: string
  emptyDesc: string
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-10 w-10" />}
        title={emptyTitle}
        description={emptyDesc}
      />
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  )
}

export function OrdersPage() {
  const { data, isLoading } = useOrders()
  const orders = data?.items ?? []

  const active = orders.filter((o) => isActive(o.status))
  const completed = orders.filter((o) => isCompleted(o.status))
  const cancelled = orders.filter((o) => isCancelled(o.status))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track and manage your orders</p>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">
            Active
            {active.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {active.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <OrderList
            orders={active}
            loading={isLoading}
            emptyTitle="No active orders"
            emptyDesc="Your active orders will appear here."
          />
        </TabsContent>
        <TabsContent value="completed">
          <OrderList
            orders={completed}
            loading={isLoading}
            emptyTitle="No completed orders"
            emptyDesc="Your completed orders will appear here."
          />
        </TabsContent>
        <TabsContent value="cancelled">
          <OrderList
            orders={cancelled}
            loading={isLoading}
            emptyTitle="No cancelled orders"
            emptyDesc="Cancelled and rejected orders appear here."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
