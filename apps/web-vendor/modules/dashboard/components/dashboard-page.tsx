'use client'

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
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['vendor-stats'],
    queryFn: dashboardService.getStats,
  })

  const { data: recentData, isLoading: ordersLoading } = useQuery({
    queryKey: ['vendor-orders', { limit: '5', sort: 'created_at:desc' }],
    queryFn: () => ordersService.getOrders({ limit: '5', sort: 'created_at:desc' }),
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
          valueClassName={stats?.active_orders ? 'text-amber-600' : undefined}
        />
        <StatsCard
          title="Completed Orders"
          value={stats?.completed_orders ?? 0}
          loading={statsLoading}
          icon={<Star className="h-5 w-5" />}
        />
      </div>

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
          {!ordersLoading && recentOrders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              description="New orders will appear here when customers place them."
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
