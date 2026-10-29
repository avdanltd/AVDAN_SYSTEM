'use client'

import { Package, CheckCircle2, XCircle, TrendingUp, Clock } from 'lucide-react'
import { StatsCard, Progress, Card, CardContent, CardHeader, CardTitle, Skeleton, EmptyState } from '@avdan/ui'
import { useHubStats } from '../hooks/use-hub-stats'

export function AnalyticsPage() {
  const { data: stats, isLoading, error } = useHubStats()

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hub performance metrics — refreshes every 30 seconds.
          </p>
        </div>
        <EmptyState
          title="Couldn't load analytics"
          description="Something went wrong fetching hub performance metrics. Check your connection and try again."
          className="py-16"
        />
      </div>
    )
  }

  const passRate = stats?.qa_pass_rate_pct ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hub performance over the last {stats?.period_days ?? 7} days
          {stats?.hub_name ? ` — ${stats.hub_name}` : ''}.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Orders Processed"
          value={stats?.orders_processed ?? 0}
          icon={<Package className="h-5 w-5" />}
          loading={isLoading}
          subtitle={`Last ${stats?.period_days ?? 7} days`}
        />
        <StatsCard
          title="QA Passed"
          value={stats?.qa_pass_count ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          loading={isLoading}
          subtitle="Cleared inspection"
          valueClassName="text-success"
        />
        <StatsCard
          title="QA Failed"
          value={stats?.qa_fail_count ?? 0}
          icon={<XCircle className="h-5 w-5" />}
          loading={isLoading}
          subtitle="Returned to vendor"
          valueClassName={(stats?.qa_fail_count ?? 0) > 0 ? 'text-destructive' : undefined}
        />
        <StatsCard
          title="QA Pass Rate"
          value={stats ? `${passRate.toFixed(0)}%` : '—'}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={isLoading}
          subtitle="All inspections this period"
          valueClassName={
            stats && passRate >= 90 ? 'text-success' : stats && passRate < 70 ? 'text-destructive' : undefined
          }
        />
      </div>

      {/* QA Pass Rate visual */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base">QA Pass Rate</CardTitle>
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
                <span className="font-semibold text-foreground">{passRate.toFixed(1)}%</span>
              </div>
              <Progress value={passRate} className="h-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span
                  className={
                    passRate >= 90
                      ? 'text-success font-medium'
                      : passRate < 70
                        ? 'text-destructive font-medium'
                        : 'text-warning font-medium'
                  }
                >
                  {passRate >= 90 ? 'Excellent' : passRate >= 70 ? 'Good' : 'Needs improvement'}
                </span>
                <span>100%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary breakdown */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base">
            This Period ({stats?.period_days ?? 7} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <dl className="divide-y divide-border">
              {[
                { label: 'Orders processed', value: stats?.orders_processed ?? 0 },
                { label: 'QA passed', value: stats?.qa_pass_count ?? 0 },
                { label: 'QA failed', value: stats?.qa_fail_count ?? 0 },
                {
                  label: 'Avg. dwell time at hub',
                  value:
                    stats?.avg_dwell_minutes != null
                      ? `${stats.avg_dwell_minutes.toFixed(0)} min`
                      : '—',
                  icon: <Clock className="h-3.5 w-3.5" />,
                },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {icon}
                    {label}
                  </dt>
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
