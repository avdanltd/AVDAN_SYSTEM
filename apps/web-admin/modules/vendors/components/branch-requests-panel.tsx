'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BranchRequest } from '@avdan/types'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/lib/format'
import { useBranchActions, useBranchRequests } from '../hooks/use-branches'

/**
 * Vendors saying "we are a branch of X", waiting for a decision. The hints under each one point
 * at things that match (name, owner, payout holder, email domain); they never decide. If in doubt,
 * open the vendor and message them for proof before approving.
 */
export function BranchRequestsPanel() {
  const router = useRouter()
  const { data } = useBranchRequests()
  const { approve, reject } = useBranchActions()
  const [approving, setApproving] = useState<BranchRequest | null>(null)
  const [rejecting, setRejecting] = useState<BranchRequest | null>(null)
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')

  const requests = data ?? []
  if (requests.length === 0) return null

  return (
    <Card className="border-warning/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Branch link requests ({requests.length})</CardTitle>
        <p className="text-xs text-muted-foreground">
          Vendors who say they are a branch of another business. Vet each one before linking: customers will see them as one brand.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">
                  {r.vendor_name}
                  <span className="font-normal text-muted-foreground"> says it is a branch of </span>
                  {r.target_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.vendor_place || 'Location not set'} · store {r.vendor_status} · asked {formatDate(r.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => router.push(ROUTES.vendor(r.vendor_id))}>
                  Open vendor
                </Button>
                <Button size="sm" onClick={() => { setApproving(r); setName(r.target_name ?? '') }}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setRejecting(r); setReason('') }}>
                  Reject
                </Button>
              </div>
            </div>
            {r.note && <p className="mt-2 rounded bg-muted p-2 text-xs text-foreground">“{r.note}”</p>}
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {r.hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>

      {approving && (
        <Dialog open onOpenChange={(o) => !o && setApproving(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Approve branch link</DialogTitle>
              <DialogDescription>
                {approving.vendor_name} will be shown to customers as a branch of {approving.target_name}. The vendor and the other branches are told.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="biz-name">Business name customers see</Label>
              <Input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} />
              <p className="text-xs text-muted-foreground">Only used when this creates the business; leave it to keep the existing name.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproving(null)} disabled={approve.isPending}>
                Cancel
              </Button>
              <Button
                disabled={approve.isPending}
                onClick={() => approve.mutate({ id: approving.id, name: name.trim() }, { onSuccess: () => setApproving(null) })}
              >
                {approve.isPending ? 'Linking…' : 'Approve & link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {rejecting && (
        <Dialog open onOpenChange={(o) => !o && setRejecting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reject branch link</DialogTitle>
              <DialogDescription>{rejecting.vendor_name} will see your reason and can ask again.</DialogDescription>
            </DialogHeader>
            <Textarea placeholder="Reason (required)…" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejecting(null)} disabled={reject.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={reason.trim().length < 3 || reject.isPending}
                onClick={() => reject.mutate({ id: rejecting.id, reason: reason.trim() }, { onSuccess: () => setRejecting(null) })}
              >
                {reject.isPending ? 'Saving…' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
