'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ShoppingBag, TrendingUp, Clock, Star } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatsCard,
  DataTable,
  OrderStatusBadge,
  EmptyState,
} from '@avdan/ui'
import type { Column } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { dashboardService } from '../services/dashboard.service'
import { ordersService } from '@/modules/orders/services/orders.service'
import type { VendorOrder } from '@/modules/orders/types'
import { formatPrice, formatRelativeTime } from '@/lib/format'

// Quick filters over the recent-orders list, so a long list stays easy to scan.
const ORDER_FILTERS = [
  { label: 'All', status: undefined },
  { label: 'Paid', status: 'PAID' },
  { label: 'Pending', status: 'PENDING' },
  { label: 'Release pending', status: 'PAYMENT_RELEASE_PENDING' },
  { label: 'Cancelled', status: 'CANCELLED' },
  { label: 'Completed', status: 'COMPLETED' },
] as const

const recentOrdersColumns: Column<VendorOrder>[] = [
  {
    key: 'id',
    header: 'Order',
    cell: (row) => (
      <span className="font-mono text-xs font-medium text-foreground">#{row.id.slice(0, 8)}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <OrderStatusBadge status={row.status} />,
  },
  {
    key: 'total',
    header: 'Total',
    cell: (row) => (
      <span className="font-medium">{formatPrice(row.total_kobo)}</span>
    ),
  },
  {
    key: 'created_at',
    header: 'Time',
    cell: (row) => (
      <span className="text-sm text-muted-foreground">{formatRelativeTime(row.created_at)}</span>
    ),
  },
]

export function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['vendor-stats'],
    queryFn: dashboardService.getStats,
  })

  const {
    data: recentData,
    isLoading: ordersLoading,
    isError: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['vendor-orders', { page_size: '10', status: statusFilter ?? 'all' }],
    queryFn: () =>
      ordersService.getOrders({ page_size: '10', ...(statusFilter ? { status: statusFilter } : {}) }),
  })

  const recentOrders = recentData?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back — here&apos;s what&apos;s happening today.
        </p>
      </div>

      {/* Stats grid */}
      {statsError ? (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="Couldn't load your stats"
          description="Something went wrong fetching your dashboard numbers."
          action={{ label: 'Retry', onClick: () => refetchStats() }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Orders"
            value={stats?.total_orders ?? 0}
            loading={statsLoading}
            icon={<ShoppingBag className="h-5 w-5" />}
          />
          <StatsCard
            title="Total Revenue"
            value={stats ? formatPrice(stats.total_revenue_kobo) : '—'}
            loading={statsLoading}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatsCard
            title="Active Orders"
            value={stats?.active_orders ?? 0}
            loading={statsLoading}
            icon={<Clock className="h-5 w-5" />}
            valueClassName={stats?.active_orders ? 'text-warning' : undefined}
          />
          <StatsCard
            title="Completed Orders"
            value={stats?.completed_orders ?? 0}
            loading={statsLoading}
            icon={<Star className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Recent orders */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="font-display text-base font-semibold">Recent Orders</CardTitle>
          <Link href={ROUTES.orders}>
            <Button variant="outline" size="sm">
              View All Orders
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-wrap gap-2 border-b border-border px-4 pb-3" role="group" aria-label="Filter orders by status">
            {ORDER_FILTERS.map((f) => (
              <Button
                key={f.label}
                type="button"
                size="sm"
                variant={statusFilter === f.status ? 'default' : 'outline'}
                aria-pressed={statusFilter === f.status}
                onClick={() => setStatusFilter(f.status)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          {ordersError ? (
            <EmptyState
              icon={<ShoppingBag className="h-6 w-6" />}
              title="Couldn't load recent orders"
              description="Something went wrong. Please try again."
              action={{ label: 'Retry', onClick: () => refetchOrders() }}
              className="py-10"
            />
          ) : !ordersLoading && recentOrders.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-6 w-6" />}
              title={statusFilter ? 'No orders with this status' : 'No orders yet'}
              description={
                statusFilter
                  ? 'Try another filter, or choose All.'
                  : 'New orders will appear here when customers place them.'
              }
              className="py-10"
            />
          ) : (
            <DataTable
              columns={recentOrdersColumns}
              data={recentOrders}
              keyExtractor={(row) => row.id}
              loading={ordersLoading}
              skeletonRows={5}
              emptyMessage="No recent orders"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
