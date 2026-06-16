'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, CheckCircle, Clock } from 'lucide-react'

import { Card, CardContent, StatsCard, EmptyState } from '@avdan/ui'
import { earningsService } from '../services/earnings.service'
import { formatPrice } from '@/lib/format'

export function EarningsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vendor-earnings'],
    queryFn: earningsService.getSummary,
  })

  if (error) {
    return (
      <EmptyState
        title="Failed to load earnings"
        description="There was a problem loading your earnings data. Please refresh the page."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Earnings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your revenue summary and payment status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Revenue"
          value={data ? formatPrice(data.total_revenue_kobo) : '—'}
          loading={isLoading}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatsCard
          title="Completed Orders"
          value={data?.completed_orders ?? 0}
          loading={isLoading}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatsCard
          title="Pending Release"
          value={data ? formatPrice(data.pending_release_kobo) : '—'}
          loading={isLoading}
          icon={<Clock className="h-5 w-5" />}
          subtitle="In escrow — released after delivery"
        />
      </div>

      {data && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-foreground">Commission Information</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              AVDAN charges a{' '}
              <span className="font-semibold text-foreground">
                {(data.commission_rate * 100).toFixed(1)}%
              </span>{' '}
              commission on each completed order. This is deducted before payment is released to
              your account.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-foreground">Earnings History</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Detailed earnings history with per-order breakdowns is coming in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
