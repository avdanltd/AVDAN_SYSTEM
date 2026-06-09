'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, Package, ArrowRight, RefreshCw } from 'lucide-react'

import { Button, OrderStatusBadge, Skeleton, EmptyState, cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { formatRelativeTime, formatKobo } from '@/lib/format'
import { useInboundOrders } from '../hooks/use-inbound-orders'
import { useReceiveOrder } from '../hooks/use-receive-order'
import type { HubOrder } from '../types'

function OrderCard({ order }: { order: HubOrder }) {
  const router = useRouter()
  const { mutate: receiveOrder, isPending } = useReceiveOrder()

  const itemCount = order.items?.length ?? 0
  const shortId = order.id.slice(0, 8).toUpperCase()

  const handleReceive = () => {
    receiveOrder(order.id)
  }

  const handleStartQa = () => {
    router.push(ROUTES.orderQa(order.id))
  }

  const canReceive = order.status === 'IN_TRANSIT_TO_HUB'
  const canQa = order.status === 'QA_IN_PROGRESS'

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:gap-6',
        canQa && 'border-amber-200 bg-amber-50/30',
      )}
    >
      {/* Order info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">#{shortId}</span>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-3.5 w-3.5" />
            {order.vendor_name ?? 'Vendor'}
          </span>
          <span>
            {itemCount > 0
              ? `${itemCount} item${itemCount !== 1 ? 's' : ''}`
              : 'No items'
            }
          </span>
          <span className="font-medium text-foreground">{formatKobo(order.total_kobo)}</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {order.arrived_at
              ? `Arrived ${formatRelativeTime(order.arrived_at)}`
              : `Created ${formatRelativeTime(order.created_at)}`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <Link href={ROUTES.order(order.id)}>
          <Button variant="ghost" size="sm" className="h-10 px-3">
            View
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Link>

        {canReceive && (
          <Button
            size="sm"
            className="h-10 min-w-[90px]"
            onClick={handleReceive}
            disabled={isPending}
          >
            {isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              'Receive'
            )}
          </Button>
        )}

        {canQa && (
          <Button
            size="sm"
            className="h-10 min-w-[90px] bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleStartQa}
          >
            Start QA
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

function OrderCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center">
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-10 w-24" />
    </div>
  )
}

interface OrderQueueProps {
  /** Optional heading override */
  heading?: string
  /** Filter by specific statuses */
  statusFilter?: string
  /** Show full page-style empty state */
  fullEmpty?: boolean
}

export function OrderQueue({ heading = 'Inbound Queue', statusFilter, fullEmpty }: OrderQueueProps) {
  const params: Record<string, string> = {}
  if (statusFilter) params.status = statusFilter

  const { data, isLoading, error } = useInboundOrders(params)

  const orders = (data?.items ?? []).slice().sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{heading}</h2>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} order{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load orders. Retrying…
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          description="No orders currently in the inbound queue."
          className={fullEmpty ? 'py-16' : 'py-8'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}
