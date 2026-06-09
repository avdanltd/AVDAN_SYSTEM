'use client'

import { Inbox, ClipboardCheck, Truck, TrendingUp } from 'lucide-react'
import { StatsCard, Progress, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@avdan/ui'
import { useHubStats } from '../hooks/use-hub-stats'

export function AnalyticsPage() {
  const { data: stats, isLoading } = useHubStats()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hub performance metrics — refreshes every 30 seconds.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Inbound Today"
          value={stats?.inbound_today ?? 0}
          icon={<Inbox className="h-5 w-5" />}
          loading={isLoading}
          subtitle="Orders arrived at hub"
        />
        <StatsCard
          title="QA Pending"
          value={stats?.qa_pending ?? 0}
          icon={<ClipboardCheck className="h-5 w-5" />}
          loading={isLoading}
          subtitle="Awaiting inspection"
          valueClassName={(stats?.qa_pending ?? 0) > 0 ? 'text-amber-600' : undefined}
        />
        <StatsCard
          title="Dispatched Today"
          value={stats?.dispatched_today ?? 0}
          icon={<Truck className="h-5 w-5" />}
          loading={isLoading}
          subtitle="Sent out for delivery"
        />
        <StatsCard
          title="QA Pass Rate"
          value={stats ? `${stats.qa_pass_rate.toFixed(0)}%` : '—'}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={isLoading}
          subtitle="All-time pass rate"
          valueClassName={
            stats && stats.qa_pass_rate >= 90
              ? 'text-green-600'
              : stats && stats.qa_pass_rate < 70
                ? 'text-destructive'
                : undefined
          }
        />
      </div>

      {/* QA Pass Rate visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">QA Pass Rate</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall pass rate</span>
                <span className="font-semibold text-foreground">
                  {stats?.qa_pass_rate.toFixed(1) ?? 0}%
                </span>
              </div>
              <Progress
                value={stats?.qa_pass_rate ?? 0}
                className="h-3"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span
                  className={
                    (stats?.qa_pass_rate ?? 0) >= 90
                      ? 'text-green-600 font-medium'
                      : (stats?.qa_pass_rate ?? 0) < 70
                        ? 'text-destructive font-medium'
                        : 'text-amber-600 font-medium'
                  }
                >
                  {(stats?.qa_pass_rate ?? 0) >= 90
                    ? 'Excellent'
                    : (stats?.qa_pass_rate ?? 0) >= 70
                      ? 'Good'
                      : 'Needs improvement'}
                </span>
                <span>100%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today at a Glance</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <dl className="divide-y divide-border">
              {[
                { label: 'Orders arrived at hub', value: stats?.inbound_today ?? 0 },
                { label: 'Orders pending QA', value: stats?.qa_pending ?? 0 },
                { label: 'Orders dispatched', value: stats?.dispatched_today ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
