'use client'

import { Inbox, PackageCheck, ClipboardCheck, BarChart2 } from 'lucide-react'
import { StatsCard } from '@avdan/ui'
import { useHubStats } from '../hooks/use-hub-stats'
import { useInboundOrders } from '../hooks/use-inbound-orders'
import { OrderQueue } from './order-queue'

const INCOMING_STATUS = 'READY_FOR_PICKUP,PICKED_UP,IN_TRANSIT_TO_HUB'
const AT_HUB_STATUS = 'ARRIVED_AT_HUB,AT_HUB,QA_IN_PROGRESS,QA_PASSED,QA_FAILED,VENDOR_REMEDIATION'

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useHubStats()

  // `.total` comes from the backend's own count query (not `items.length`), so page_size doesn't
  // matter for these numbers. The "Incoming" query below shares its exact params (and therefore
  // its TanStack Query cache) with the <OrderQueue heading="Incoming"> section further down, so
  // that one doesn't cost an extra request. These replace the "_today" fields the backend's
  // `/hub/analytics` has never actually returned (see `HubStats` in modules/hub/types.ts).
  const { data: incoming, isLoading: incomingLoading, error: incomingError } = useInboundOrders({
    status: INCOMING_STATUS,
  })
  const { data: atHub, isLoading: atHubLoading, error: atHubError } = useInboundOrders({
    status: 'ARRIVED_AT_HUB',
  })
  const { data: qaInProgress, isLoading: qaLoading, error: qaError } = useInboundOrders({
    status: 'QA_IN_PROGRESS',
  })

  // A failed fetch should never look identical to "zero orders" — surface it in the subtitle
  // instead of quietly falling back to `?? 0`.
  const errSubtitle = (fallback: string, err: unknown) => (err ? "Couldn't load" : fallback)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Hub Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live queue updates every 15 seconds.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Incoming"
          value={incomingError ? '—' : (incoming?.total ?? 0)}
          icon={<Inbox className="h-5 w-5" />}
          loading={incomingLoading}
          subtitle={errSubtitle('En route to this hub', incomingError)}
          valueClassName={incomingError ? 'text-destructive' : undefined}
        />
        <StatsCard
          title="Awaiting Receive"
          value={atHubError ? '—' : (atHub?.total ?? 0)}
          icon={<PackageCheck className="h-5 w-5" />}
          loading={atHubLoading}
          subtitle={errSubtitle('Arrived, not yet received', atHubError)}
          valueClassName={
            atHubError ? 'text-destructive' : (atHub?.total ?? 0) > 0 ? 'text-warning' : undefined
          }
        />
        <StatsCard
          title="QA In Progress"
          value={qaError ? '—' : (qaInProgress?.total ?? 0)}
          icon={<ClipboardCheck className="h-5 w-5" />}
          loading={qaLoading}
          subtitle={errSubtitle('Being inspected now', qaError)}
          valueClassName={qaError ? 'text-destructive' : undefined}
        />
        <StatsCard
          title="QA Pass Rate"
          value={statsError ? '—' : stats ? `${stats.qa_pass_rate_pct.toFixed(0)}%` : '—'}
          icon={<BarChart2 className="h-5 w-5" />}
          loading={statsLoading}
          subtitle={errSubtitle(`Last ${stats?.period_days ?? 7} days`, statsError)}
          valueClassName={
            stats && stats.qa_pass_rate_pct >= 90
              ? 'text-success'
              : stats && stats.qa_pass_rate_pct < 70
                ? 'text-destructive'
                : undefined
          }
        />
      </div>

      {/* Incoming — assigned to this hub but not yet physically here */}
      <div className="rounded-xl border border-border bg-background p-5 shadow-card">
        <OrderQueue heading="Incoming" statusFilter={INCOMING_STATUS} />
      </div>

      {/* At Hub / QA — physically here (or the rider says they've arrived), actionable */}
      <div className="rounded-xl border border-border bg-background p-5 shadow-card">
        <OrderQueue heading="At Hub / QA" statusFilter={AT_HUB_STATUS} />
      </div>
    </div>
  )
}
