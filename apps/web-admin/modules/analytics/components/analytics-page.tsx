'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

import {
  StatsCard,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Skeleton,
} from '@avdan/ui'
import {
  ShoppingBag,
  Bike,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Package,
} from 'lucide-react'
import { formatKobo } from '@/lib/format'
import { usePlatformOverview } from '../hooks/use-platform-overview'
import { useOrderVolume } from '../hooks/use-order-volume'

type Period = 'day' | 'week' | 'month'

const PERIOD_DAYS: Record<Period, string> = {
  day: '24 hours',
  week: '7 days',
  month: '30 days',
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('month')

  const { data: overview, isLoading: overviewLoading } = usePlatformOverview()
  const { data: volumeData, isLoading: volumeLoading } = useOrderVolume(period)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Platform-wide metrics and trends</p>
        </div>
        <div className="flex items-center gap-2">
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {PERIOD_DAYS[p]}
            </Button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatsCard
          title="Active Orders"
          value={overview?.active_orders ?? 0}
          icon={<ShoppingBag className="h-5 w-5" />}
          loading={overviewLoading}
        />
        <StatsCard
          title="Orders Today"
          value={overview?.orders_today ?? 0}
          icon={<Package className="h-5 w-5" />}
          loading={overviewLoading}
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
        <StatsCard
          title="Pending Disputes"
          value={overview?.pending_disputes ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          loading={overviewLoading}
          valueClassName={
            (overview?.pending_disputes ?? 0) > 0 ? 'text-destructive' : 'text-foreground'
          }
        />
      </div>

      {/* Order Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Order Volume — {PERIOD_DAYS[period]}</CardTitle>
          <CardDescription>Number of orders placed in the selected period</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {volumeLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={volumeData?.data ?? []}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <defs>
                  <linearGradient id="colorOrdersAnalytics" x1="0" y1="0" x2="0" y2="1">
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
                <Legend />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Orders"
                  stroke="hsl(199 89% 48%)"
                  fillOpacity={1}
                  fill="url(#colorOrdersAnalytics)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue — {PERIOD_DAYS[period]}</CardTitle>
          <CardDescription>Daily revenue in ₦ for the selected period</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
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
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
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
                <Legend />
                <Bar
                  dataKey="revenue_kobo"
                  name="Revenue"
                  fill="hsl(142 76% 36%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
