'use client'

import {
  ShoppingBag,
  Bike,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

import {
  StatsCard,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Skeleton,
} from '@avdan/ui'
import { formatKobo } from '@/lib/format'
import { usePlatformOverview } from '../hooks/use-platform-overview'
import { useOrderVolume } from '../hooks/use-order-volume'
import { ROUTES } from '@/config/routes'
import Link from 'next/link'

export function DashboardPage() {
  const { data: overview, isLoading: overviewLoading, refetch } = usePlatformOverview()
  const { data: volumeData, isLoading: volumeLoading } = useOrderVolume('month')

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform overview — auto-refreshes every 30s</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Active Orders"
          value={overview?.active_orders ?? 0}
          icon={<ShoppingBag className="h-5 w-5" />}
          loading={overviewLoading}
          subtitle={`${overview?.orders_today ?? 0} orders today`}
        />
        <StatsCard
          title="Riders Online"
          value={overview?.riders_online ?? 0}
          icon={<Bike className="h-5 w-5" />}
          loading={overviewLoading}
        />
        <StatsCard
          title="Revenue Today"
          value={overview ? formatKobo(overview.revenue_today_kobo) : '—'}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={overviewLoading}
        />
        <StatsCard
          title="Total GMV"
          value={overview ? formatKobo(overview.gmv_kobo) : '—'}
          icon={<DollarSign className="h-5 w-5" />}
          loading={overviewLoading}
        />
      </div>

      {/* Chart + Disputes Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Volume (30 days)</CardTitle>
              <CardDescription>Daily order count over the last month</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              {volumeLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={volumeData?.data ?? []}
                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(199 89% 48%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(199 89% 48%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'white',
                        border: '1px solid hsl(214 32% 91%)',
                        borderRadius: 8,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Orders"
                      stroke="hsl(199 89% 48%)"
                      fillOpacity={1}
                      fill="url(#colorOrders)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Pending Disputes</CardTitle>
                <CardDescription>Requires resolution</CardDescription>
              </div>
              {!overviewLoading && (overview?.pending_disputes ?? 0) > 0 && (
                <Badge variant="destructive" className="text-sm">
                  {overview?.pending_disputes}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
              {overviewLoading ? (
                <Skeleton className="h-16 w-16 rounded-full" />
              ) : (
                <>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                  </div>
                  <p className="text-4xl font-bold text-foreground">
                    {overview?.pending_disputes ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Open disputes</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={ROUTES.disputes}>View Disputes</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revenue Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue (30 days)</CardTitle>
          <CardDescription>Daily revenue in ₦ over the last month</CardDescription>
        </CardHeader>
        <CardContent className="h-48">
          {volumeLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={volumeData?.data ?? []}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `₦${(v / 100000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid hsl(214 32% 91%)',
                    borderRadius: 8,
                  }}
                  formatter={(value: unknown) => [formatKobo(Number(value)), 'Revenue']}
                />
                <Bar dataKey="revenue_kobo" name="Revenue" fill="hsl(199 89% 48%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
