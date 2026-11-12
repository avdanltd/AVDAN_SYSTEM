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
import { payoutStamp } from '@avdan/types'
import { formatDate, formatKobo } from '@/lib/format'
import {
  useApprovePayout,
  usePayout,
  usePayoutPinStatus,
  useRefreshPayout,
  useRejectPayout,
  useSetPayoutPin,
} from '../hooks/use-payouts'
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
  const refresh = useRefreshPayout()

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

            {request.decided_by_name && (
              <p className="text-sm text-muted-foreground">
                {request.status === 'REJECTED' ? 'Rejected' : 'Approved'} by{' '}
                <span className="font-medium text-foreground">{request.decided_by_name}</span>
                {request.decided_at ? ` · ${formatDate(request.decided_at)}` : ''}
              </p>
            )}

            {(request.status === 'PAID' || request.status === 'PROCESSING') && payoutStamp(request) && (
              <p className="text-sm text-muted-foreground">
                {request.status === 'PAID' ? 'Paid to bank' : 'Sending to bank since'}{' '}
                <span className="font-medium text-foreground">{formatDate(payoutStamp(request)!.at)}</span>
              </p>
            )}

            {request.status === 'PROCESSING' && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                <p className="text-muted-foreground">
                  Sent to Paystack and waiting for the bank. If the money has already arrived, check
                  with Paystack to update this.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={refresh.isPending}
                  onClick={() => refresh.mutate(request.id)}
                >
                  {refresh.isPending ? 'Checking…' : 'Check status'}
                </Button>
              </div>
            )}

            {request.status === 'REQUESTED' && (
              <DecisionForm
                key={request.id}
                requestedKobo={request.requested_kobo}
                recipient={`${String(request.destination?.account_name ?? '—')} · ${String(request.destination?.bank_name ?? '—')} ${String(request.destination?.account_number_masked ?? '')}`}
                ownerName={request.owner_name ?? '—'}
                busy={approve.isPending || reject.isPending}
                onApprove={(approvedKobo, note, pin, onFail) =>
                  approve.mutate(
                    { id: request.id, approvedKobo, note, pin },
                    { onSuccess: onClose, onError: onFail },
                  )
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
  recipient,
  ownerName,
  busy,
  onApprove,
  onReject,
}: {
  requestedKobo: number
  recipient: string
  ownerName: string
  busy: boolean
  onApprove: (approvedKobo: number, note: string | null, pin: string, onFail: () => void) => void
  onReject: (note: string) => void
}) {
  const [amount, setAmount] = useState(String(requestedKobo / 100))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pin, setPin] = useState('')
  const pinStatus = usePayoutPinStatus()

  const approvedKobo = Math.round(Number(amount) * 100)

  function startApprove() {
    if (!Number.isFinite(approvedKobo) || approvedKobo <= 0) return setError('Enter an amount to approve.')
    if (approvedKobo > requestedKobo) return setError('Cannot approve more than was requested.')
    setError(null)
    setConfirming(true)
  }

  function confirmApprove() {
    if (!/^\d{4}$/.test(pin)) return setError('Enter your 4-digit payout PIN.')
    setError(null)
    onApprove(approvedKobo, note.trim() || null, pin, () => setPin(''))
  }

  function rejectRequest() {
    if (note.trim().length < 3) return setError('A reason is required to reject (shown to the requester).')
    setError(null)
    onReject(note.trim())
  }

  if (confirming) {
    return (
      <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-sm font-semibold text-foreground">Confirm this payout</p>
        <div className="rounded-md bg-secondary/50 p-3 text-sm">
          <p className="text-2xl font-semibold tabular-nums text-foreground">{formatKobo(approvedKobo)}</p>
          <p className="text-muted-foreground">
            to <span className="font-medium text-foreground">{ownerName}</span>
          </p>
          <p className="text-muted-foreground">{recipient}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          This sends real money to their bank and cannot be undone. Your name is recorded as the
          approving admin.
        </p>
        {pinStatus.data && !pinStatus.data.is_set ? (
          <PinSetup />
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="payout-pin">Your payout PIN</Label>
            <Input
              id="payout-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
            Back
          </Button>
          <Button disabled={busy || !pinStatus.data?.is_set} onClick={confirmApprove}>
            {busy ? 'Sending…' : `Send ${formatKobo(approvedKobo)}`}
          </Button>
        </div>
      </div>
    )
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
        <Button disabled={busy} onClick={startApprove}>
          Review & approve
        </Button>
      </div>
    </div>
  )
}

function PinSetup() {
  const setPinMutation = useSetPayoutPin()
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const valid = /^\d{4}$/.test(pin) && password.length > 0

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3">
      <p className="text-sm text-foreground">
        Set a 4-digit payout PIN first. You&apos;ll enter it every time you approve a payout.
      </p>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="New 4-digit PIN"
        aria-label="New payout PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
      />
      <Input
        type="password"
        autoComplete="current-password"
        placeholder="Your account password"
        aria-label="Your account password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button
        size="sm"
        disabled={!valid || setPinMutation.isPending}
        onClick={() => setPinMutation.mutate({ pin, currentPassword: password })}
      >
        {setPinMutation.isPending ? 'Saving…' : 'Save PIN'}
      </Button>
    </div>
  )
}
