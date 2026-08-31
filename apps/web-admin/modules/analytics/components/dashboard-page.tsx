'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShoppingBag,
  Bike,
  TrendingUp,
  DollarSign,
  RefreshCw,
  Download,
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
  DataTable,
  type Column,
} from '@avdan/ui'
import { formatKobo, formatRelativeTime } from '@/lib/format'
import { usePlatformOverview } from '../hooks/use-platform-overview'
import { useOrderVolume } from '../hooks/use-order-volume'
import { useAdminDisputes } from '@/modules/disputes/hooks/use-admin-disputes'
import type { AdminDispute } from '@/modules/disputes/types'
import { ROUTES } from '@/config/routes'

const BRAND_PRIMARY = '#135BEC'
const BORDER_COLOR = 'hsl(214 32% 91%)'

function formatSecondsAgo(timestampMs: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const DISPUTE_COLUMNS: Column<AdminDispute>[] = [
  {
    key: 'id',
    header: 'Dispute ID',
    cell: (row) => <span className="font-mono text-xs text-foreground">{row.id.slice(0, 10)}…</span>,
  },
  {
    key: 'order_id',
    header: 'Order ID',
    cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.order_id.slice(0, 10)}…</span>,
  },
  {
    key: 'raised_by',
    header: 'Raised By',
    cell: (row) => (
      <Badge variant="secondary" className="text-xs capitalize">
        {row.raised_by}
      </Badge>
    ),
  },
  {
    key: 'reason',
    header: 'Reason',
    cell: (row) => <span className="text-sm capitalize">{row.reason.replace(/_/g, ' ')}</span>,
  },
  {
    key: 'created_at',
    header: 'Opened',
    cell: (row) => <span className="text-xs text-muted-foreground">{formatRelativeTime(row.created_at)}</span>,
  },
]

export function DashboardPage() {
  const { data: overview, isLoading: overviewLoading, refetch, dataUpdatedAt } = usePlatformOverview()
  const { data: volumeData, isLoading: volumeLoading } = useOrderVolume('day')
  const { data: disputesData, isLoading: disputesLoading } = useAdminDisputes({
    page: '1',
    limit: '5',
    status: 'open',
  })

  // Force a re-render every few seconds so the "Updated Xs ago" text stays live.
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5_000)
    return () => clearInterval(interval)
  }, [])

  function handleExport() {
    const rows: (string | number)[][] = [
      ['Metric', 'Value'],
      ['Active Orders', overview?.active_orders ?? 0],
      ['Orders Today', overview?.orders_today ?? 0],
      ['Riders Online', overview?.riders_online ?? 0],
      ['Revenue Today (kobo)', overview?.revenue_today_kobo ?? 0],
      ['Total GMV (kobo)', overview?.gmv_today_kobo ?? 0],
      ['Pending Disputes', overview?.pending_disputes ?? 0],
      [],
      ['Date', 'Order Count', 'Revenue (kobo)'],
      ...(volumeData?.data ?? []).map((d) => [d.period, d.order_count, d.volume_kobo]),
    ]
    downloadCsv(`avdan-dashboard-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time logistics performance across the network.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Updated {overviewLoading ? '…' : formatSecondsAgo(dataUpdatedAt)}
          </span>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
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
          value={overview ? formatKobo(overview.gmv_today_kobo) : '—'}
          icon={<DollarSign className="h-5 w-5" />}
          loading={overviewLoading}
          tone="accent"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Order Volume (30 days)</CardTitle>
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
                      <stop offset="5%" stopColor={BRAND_PRIMARY} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={BRAND_PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER_COLOR} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.slice(5, 10)}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'white',
                      border: `1px solid ${BORDER_COLOR}`,
                      borderRadius: 8,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="order_count"
                    name="Orders"
                    stroke={BRAND_PRIMARY}
                    fillOpacity={1}
                    fill="url(#colorOrders)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Revenue (30 days)</CardTitle>
            <CardDescription>Daily revenue in ₦ over the last month</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {volumeLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={volumeData?.data ?? []}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER_COLOR} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.slice(5, 10)}
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
                      border: `1px solid ${BORDER_COLOR}`,
                      borderRadius: 8,
                    }}
                    formatter={(value: unknown) => [formatKobo(Number(value)), 'Revenue']}
                  />
                  <Bar dataKey="volume_kobo" name="Revenue" fill={BRAND_PRIMARY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Disputes table */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="font-display">Recent Open Disputes</CardTitle>
            <CardDescription>Most recent items awaiting resolution</CardDescription>
          </div>
          <Link href={ROUTES.disputes} className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={DISPUTE_COLUMNS}
            data={disputesData?.items ?? []}
            keyExtractor={(row) => row.id}
            loading={disputesLoading}
            emptyMessage="No open disputes."
          />
        </CardContent>
      </Card>
    </div>
  )
}
