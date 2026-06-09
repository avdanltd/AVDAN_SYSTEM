'use client'

import { Inbox, ClipboardCheck, Truck, BarChart2 } from 'lucide-react'
import { StatsCard } from '@avdan/ui'
import { useHubStats } from '../hooks/use-hub-stats'
import { OrderQueue } from './order-queue'

export function DashboardPage() {
  const { data: stats, isLoading } = useHubStats()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hub Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live queue updates every 15 seconds.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Inbound Today"
          value={stats?.inbound_today ?? 0}
          icon={<Inbox className="h-5 w-5" />}
          loading={isLoading}
        />
        <StatsCard
          title="QA Pending"
          value={stats?.qa_pending ?? 0}
          icon={<ClipboardCheck className="h-5 w-5" />}
          loading={isLoading}
          valueClassName={
            (stats?.qa_pending ?? 0) > 0 ? 'text-amber-600' : undefined
          }
        />
        <StatsCard
          title="Dispatched Today"
          value={stats?.dispatched_today ?? 0}
          icon={<Truck className="h-5 w-5" />}
          loading={isLoading}
        />
        <StatsCard
          title="QA Pass Rate"
          value={stats ? `${stats.qa_pass_rate.toFixed(0)}%` : '—'}
          icon={<BarChart2 className="h-5 w-5" />}
          loading={isLoading}
          valueClassName={
            stats && stats.qa_pass_rate >= 90
              ? 'text-green-600'
              : stats && stats.qa_pass_rate < 70
                ? 'text-destructive'
                : undefined
          }
        />
      </div>

      {/* Inbound Queue */}
      <div className="rounded-xl border border-border bg-background p-5">
        <OrderQueue />
      </div>
    </div>
  )
}
