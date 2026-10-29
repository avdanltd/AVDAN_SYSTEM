'use client'

import { useState } from 'react'

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Skeleton,
  Textarea,
} from '@avdan/ui'
import { formatDate, formatKobo } from '@/lib/format'
import { useApprovePayout, usePayout, useRejectPayout } from '../hooks/use-payouts'
import { STATUS_LABEL, STATUS_VARIANT } from './status'

const EVENT_LABEL: Record<string, string> = {
  REQUESTED: 'Requested by owner',
  APPROVED: 'Approved by admin',
  REJECTED: 'Rejected by admin',
  TRANSFER_SUCCESS: 'Bank transfer confirmed',
  TRANSFER_FAILED: 'Bank transfer failed — funds returned',
}

export function PayoutDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: request, isLoading, isError } = usePayout(id)
  const approve = useApprovePayout()
  const reject = useRejectPayout()

  // Reset the form per request by keying it on the id (see render below).
  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Withdrawal request</DialogTitle>
          <DialogDescription>
            Review the amount and destination, then approve or reject. Every decision is recorded.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <Skeleton className="h-48 w-full" />}
        {isError && <p className="text-sm text-destructive">Couldn&apos;t load this request.</p>}

        {request && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{request.owner_type === 'vendor' ? 'Vendor' : 'Rider'}</p>
                <p className="font-medium text-foreground">{request.owner_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={STATUS_VARIANT[request.status] ?? 'outline'}>
                  {STATUS_LABEL[request.status] ?? request.status}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Requested</p>
                <p className="text-lg font-semibold tabular-nums">{formatKobo(request.requested_kobo)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Approved</p>
                <p className="text-lg font-semibold tabular-nums">
                  {request.approved_kobo != null ? formatKobo(request.approved_kobo) : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Still available in wallet</p>
                <p className="font-medium tabular-nums">
                  {request.owner_available_kobo != null ? formatKobo(request.owner_available_kobo) : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Lifetime earned</p>
                <p className="font-medium tabular-nums">
                  {request.owner_lifetime_earned_kobo != null
                    ? formatKobo(request.owner_lifetime_earned_kobo)
                    : '—'}
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border bg-secondary/50 p-3 text-sm">
              <p className="text-muted-foreground">Pays to</p>
              <p className="font-medium text-foreground">
                {String(request.destination?.account_name ?? '—')} ·{' '}
                {String(request.destination?.bank_name ?? '—')}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {String(request.destination?.account_number_masked ?? '')}
              </p>
            </div>

            {request.status === 'REQUESTED' && (
              <DecisionForm
                key={request.id}
                requestedKobo={request.requested_kobo}
                busy={approve.isPending || reject.isPending}
                onApprove={(approvedKobo, note) =>
                  approve.mutate({ id: request.id, approvedKobo, note }, { onSuccess: onClose })
                }
                onReject={(note) => reject.mutate({ id: request.id, note }, { onSuccess: onClose })}
              />
            )}

            {request.decision_note && (
              <p className="text-sm text-muted-foreground">
                Admin note: <span className="text-foreground">{request.decision_note}</span>
              </p>
            )}

            <Separator />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Audit trail</h3>
              <ol className="space-y-2">
                {(request.events ?? []).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{EVENT_LABEL[e.event] ?? e.event}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.actor_role}
                        {e.actor_id ? ` · ${e.actor_id.slice(0, 8)}` : ''}
                        {e.note ? ` — ${e.note}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      {e.amount_kobo != null && (
                        <p className="tabular-nums">{formatKobo(e.amount_kobo)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDate(e.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DecisionForm({
  requestedKobo,
  busy,
  onApprove,
  onReject,
}: {
  requestedKobo: number
  busy: boolean
  onApprove: (approvedKobo: number, note: string | null) => void
  onReject: (note: string) => void
}) {
  const [amount, setAmount] = useState(String(requestedKobo / 100))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function approve() {
    const kobo = Math.round(Number(amount) * 100)
    if (!Number.isFinite(kobo) || kobo <= 0) return setError('Enter an amount to approve.')
    if (kobo > requestedKobo) return setError('Cannot approve more than was requested.')
    setError(null)
    onApprove(kobo, note.trim() || null)
  }

  function rejectRequest() {
    if (note.trim().length < 3) return setError('A reason is required to reject (shown to the requester).')
    setError(null)
    onReject(note.trim())
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="approve-amount">Amount to send (₦)</Label>
        <Input
          id="approve-amount"
          type="number"
          step="0.01"
          min="0"
          max={requestedKobo / 100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Requested {formatKobo(requestedKobo)}. Approving less returns the difference to their wallet.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="decision-note">Note (required to reject)</Label>
        <Textarea
          id="decision-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="destructive" disabled={busy} onClick={rejectRequest}>
          Reject
        </Button>
        <Button disabled={busy} onClick={approve}>
          {busy ? 'Working…' : 'Approve & send'}
        </Button>
      </div>
    </div>
  )
}
