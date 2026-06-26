'use client'

import { useRouter } from 'next/navigation'
import { DataTable, OrderStatusBadge, EmptyState, type Column } from '@avdan/ui'
import { ShoppingBag } from 'lucide-react'
import { useOrders } from '../hooks/use-orders'
import type { Order } from '../services/orders.service'
import { ROUTES } from '@/config/routes'

function formatPrice(kobo: number): string {
  return (kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const columns: Column<Order>[] = [
  {
    key: 'id',
    header: 'Order ID',
    cell: (row) => (
      <span className="font-mono text-xs text-muted-foreground">
        #{row.id.slice(0, 8).toUpperCase()}
      </span>
    ),
  },
  {
    key: 'vendor',
    header: 'Vendor',
    cell: (row) => (
      <span className="text-sm font-medium">{row.vendor_name ?? row.vendor_id.slice(0, 8)}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <OrderStatusBadge status={row.status} />,
  },
  {
    key: 'total',
    header: 'Amount',
    cell: (row) => <span className="font-semibold">{formatPrice(row.total_kobo)}</span>,
  },
  {
    key: 'date',
    header: 'Date',
    cell: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>,
  },
]

export function OrdersPage() {
  const router = useRouter()
  const { data, isLoading, error } = useOrders()
  const orders = data?.items ?? []

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
        <EmptyState
          title="Could not load orders"
          description={error.message}
          action={{ label: 'Retry', onClick: () => window.location.reload() }}
          icon={<ShoppingBag className="h-6 w-6" />}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
        <p className="mt-1 text-muted-foreground">Track and manage your orders</p>
      </div>

      {!isLoading && orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Start shopping to see your orders here."
          action={{
            label: 'Browse vendors',
            onClick: () => router.push(ROUTES.home),
          }}
          icon={<ShoppingBag className="h-6 w-6" />}
        />
      ) : (
        <DataTable<Order>
          columns={columns}
          data={orders}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          skeletonRows={5}
          onRowClick={(row) => router.push(ROUTES.order(row.id))}
          emptyMessage="No orders found."
        />
      )}

      {!isLoading && data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {orders.length} of {data.total} orders
          </span>
        </div>
      )}
    </div>
  )
}
