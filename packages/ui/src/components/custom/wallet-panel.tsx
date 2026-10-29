'use client'

import * as React from 'react'
import type { PayoutRequest, WalletEntry, WalletSummary } from '@avdan/types'

import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { StatsCard } from './stats-card'
import { DataTable, type Column } from './data-table'
import { EmptyState } from './empty-state'

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Awaiting approval',
  PROCESSING: 'Sending to bank',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  FAILED: 'Transfer failed',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'accent'> = {
  REQUESTED: 'accent',
  PROCESSING: 'secondary',
  PAID: 'default',
  REJECTED: 'destructive',
  FAILED: 'destructive',
}

const ENTRY_LABEL: Record<string, string> = {
  ORDER_CREDIT: 'Earning added',
  WITHDRAWAL_HOLD: 'Withdrawal requested',
  WITHDRAWAL_RELEASE: 'Returned to available',
  WITHDRAWAL_REVERSAL: 'Transfer failed — returned',
}

export interface WalletPanelProps {
  summary?: WalletSummary
  requests?: PayoutRequest[]
  entries?: WalletEntry[]
  loading: boolean
  error: boolean
  onRetry: () => void
  /** Vendors have a dispute window between delivery and withdrawable; riders do not. */
  showClearing: boolean
  /** Amount in kobo; rejects with the API error message so the dialog can show it. */
  onRequestWithdrawal: (amountKobo: number) => Promise<void>
  submitting: boolean
  formatMoney: (kobo: number) => string
  formatDate: (iso: string) => string
  /** Called when the owner has no bank account saved and tries to withdraw. */
  onSetupAccount?: () => void
}

export function WalletPanel({
  summary,
  requests = [],
  entries = [],
  loading,
  error,
  onRetry,
  showClearing,
  onRequestWithdrawal,
  submitting,
  formatMoney,
  formatDate,
  onSetupAccount,
}: WalletPanelProps) {
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  if (error) {
    return (
      <EmptyState
        title="Failed to load your wallet"
        description="There was a problem loading your balances. Please try again."
        action={{ label: 'Retry', onClick: onRetry }}
      />
    )
  }

  const available = summary?.available_kobo ?? 0
  const min = summary?.min_withdrawal_kobo ?? 0

  const openDialog = () => {
    setAmount(available > 0 ? String(available / 100) : '')
    setFormError(null)
    setOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const naira = Number(amount)
    if (!Number.isFinite(naira) || naira <= 0) return setFormError('Enter an amount.')
    const kobo = Math.round(naira * 100)
    if (kobo < min) return setFormError(`Minimum withdrawal is ${formatMoney(min)}.`)
    if (kobo > available) return setFormError('That is more than your available balance.')
    setFormError(null)
    try {
      await onRequestWithdrawal(kobo)
      setOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit your request.')
    }
  }

  const requestColumns: Column<PayoutRequest>[] = [
    { key: 'date', header: 'Requested', cell: (r) => formatDate(r.created_at) },
    { key: 'asked', header: 'Amount asked', cell: (r) => formatMoney(r.requested_kobo) },
    {
      key: 'approved',
      header: 'Approved',
      cell: (r) => (r.approved_kobo != null ? formatMoney(r.approved_kobo) : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
      ),
    },
    {
      key: 'note',
      header: 'Note from AVDAN',
      cell: (r) => r.decision_note || (r.failure_reason ? 'Bank transfer failed' : '—'),
    },
  ]

  const entryColumns: Column<WalletEntry>[] = [
    { key: 'date', header: 'Date', cell: (e) => formatDate(e.created_at) },
    { key: 'what', header: 'Activity', cell: (e) => ENTRY_LABEL[e.kind] ?? e.kind },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      cell: (e) => (
        <span className={e.amount_kobo < 0 ? 'text-muted-foreground' : 'font-medium text-foreground'}>
          {e.amount_kobo < 0 ? '−' : '+'}
          {formatMoney(Math.abs(e.amount_kobo))}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Ongoing"
          value={summary ? formatMoney(summary.ongoing_kobo) : '—'}
          loading={loading}
          subtitle="Orders in progress"
        />
        {showClearing && (
          <StatsCard
            title="Delivered"
            value={summary ? formatMoney(summary.clearing_kobo + summary.on_hold_kobo) : '—'}
            loading={loading}
            subtitle="Clearing the dispute window"
          />
        )}
        <StatsCard
          title="Available"
          value={summary ? formatMoney(available) : '—'}
          loading={loading}
          subtitle="Ready to withdraw"
          tone="accent"
        />
        <StatsCard
          title="Requested"
          value={summary ? formatMoney(summary.requested_kobo) : '—'}
          loading={loading}
          subtitle="Waiting for approval or bank"
        />
        <StatsCard
          title="Paid out"
          value={summary ? formatMoney(summary.paid_out_kobo) : '—'}
          loading={loading}
          subtitle="Collected to your bank"
        />
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold text-foreground">Withdraw funds</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Request any amount up to your available balance (minimum {summary ? formatMoney(min) : '—'}).
              An AVDAN admin reviews each request and sends the approved amount to your saved bank account.
            </p>
            {summary && !summary.has_payout_account && (
              <p className="mt-2 text-sm font-medium text-destructive">
                Add a payout bank account first.{' '}
                {onSetupAccount && (
                  <button type="button" className="underline" onClick={onSetupAccount}>
                    Set it up
                  </button>
                )}
              </p>
            )}
          </div>
          <Button
            onClick={openDialog}
            disabled={loading || !summary?.has_payout_account || available < min}
          >
            Request withdrawal
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-foreground">Withdrawal requests</h2>
        <DataTable
          columns={requestColumns}
          data={requests}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No withdrawal requests yet."
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-foreground">Wallet activity</h2>
        <DataTable
          columns={entryColumns}
          data={entries}
          keyExtractor={(e) => e.id}
          loading={loading}
          emptyMessage="Earnings will appear here as your orders complete."
        />
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Request withdrawal</DialogTitle>
              <DialogDescription>
                Available now: {formatMoney(available)}. You will be notified once an admin decides.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">Amount (₦)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                inputMode="decimal"
                min={min / 100}
                max={available / 100}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
