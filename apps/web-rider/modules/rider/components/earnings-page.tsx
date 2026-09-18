'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Banknote, CheckCircle2, Clock, Wallet } from 'lucide-react'
import { Badge, Card, CardContent, EmptyState, Skeleton } from '@avdan/ui'

import { useEarningsSummary, usePayoutHistory } from '../hooks/use-earnings'
import { formatKobo } from '@/lib/format'
import type { RiderPayout } from '../types'

const STATUS_LABEL: Record<RiderPayout['status'], string> = {
  PENDING: 'Owed',
  PAYOUT_PENDING: 'Processing',
  RELEASED: 'Paid',
  FAILED: 'Failed',
}

const STATUS_CLASS: Record<RiderPayout['status'], string> = {
  RELEASED: 'bg-success-muted text-success',
  FAILED: '',
  PENDING: 'bg-warning-muted text-warning',
  PAYOUT_PENDING: 'bg-warning-muted text-warning',
}

function orderRef(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function EarningsPage() {
  const router = useRouter()
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } =
    useEarningsSummary()
  const { data: history, isLoading: historyLoading, isError: historyError, refetch: refetchHistory } =
    usePayoutHistory()

  const payouts = history?.items ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <h1 className="text-lg font-semibold">Earnings</h1>

      {summaryLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summaryError ? (
        <Card>
          <CardContent className="p-4">
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="Couldn't load your earnings"
              description="Check your connection and try again."
              action={{ label: 'Retry', onClick: () => refetchSummary() }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="space-y-1 p-4">
              <Wallet className="h-4 w-4 text-success" />
              <p className="text-base font-semibold">{formatKobo(summary?.total_earned_kobo ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Total earned</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-4">
              <Clock className="h-4 w-4 text-warning" />
              <p className="text-base font-semibold">{formatKobo(summary?.pending_kobo ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-4">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <p className="text-base font-semibold">{summary?.deliveries_paid ?? 0}</p>
              <p className="text-xs text-muted-foreground">Paid deliveries</p>
            </CardContent>
          </Card>
        </div>
      )}

      <h2 className="text-sm font-semibold">Payout history</h2>

      {historyLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : historyError ? (
        <Card>
          <CardContent className="p-4">
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="Couldn't load payout history"
              description="Check your connection and try again."
              action={{ label: 'Retry', onClick: () => refetchHistory() }}
            />
          </CardContent>
        </Card>
      ) : payouts.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <EmptyState
              icon={<Banknote className="h-6 w-6" />}
              title="No payouts yet"
              description="You're paid the delivery fee for each order once it's delivered."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <Card key={payout.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{orderRef(payout.order_id)}</p>
                  <p className="text-base font-semibold">{formatKobo(payout.amount_kobo)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(payout.created_at)}</p>
                </div>
                <Badge
                  variant={payout.status === 'FAILED' ? 'destructive' : 'secondary'}
                  className={STATUS_CLASS[payout.status]}
                >
                  {STATUS_LABEL[payout.status]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
