'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Skeleton,
  EmptyState,
} from '@avdan/ui'
import { useAdminDispute } from '../hooks/use-admin-dispute'
import { useResolveDispute } from '../hooks/use-resolve-dispute'
import type { ResolveDisputePayload } from '../types'
import { formatDate } from '@/lib/format'
import { ROUTES } from '@/config/routes'

interface DisputeDetailPageProps {
  disputeId: string
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'destructive',
  pending: 'outline',
  resolved: 'secondary',
  closed: 'secondary',
}

export function DisputeDetailPage({ disputeId }: DisputeDetailPageProps) {
  const router = useRouter()
  const { data: dispute, isLoading } = useAdminDispute(disputeId)
  const { mutate: resolve, isPending: resolving } = useResolveDispute(disputeId)

  const [decision, setDecision] = useState<ResolveDisputePayload['decision'] | ''>('')
  const [reason, setReason] = useState('')
  const [splitPct, setSplitPct] = useState('50')
  const [confirmText, setConfirmText] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleResolve() {
    if (!decision) return
    const payload: ResolveDisputePayload = {
      decision,
      reason,
      ...(decision === 'split' ? { split_percentage: Number(splitPct) } : {}),
    }
    resolve(payload, {
      onSuccess: () => {
        setConfirmOpen(false)
        setConfirmText('')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!dispute) {
    return (
      <div className="p-6">
        <EmptyState title="Dispute not found" description="This dispute does not exist." />
      </div>
    )
  }

  const isOpen = dispute.status === 'open' || dispute.status === 'pending'

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(ROUTES.disputes)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg font-semibold text-foreground">{dispute.id}</h1>
            <Badge
              variant={STATUS_VARIANTS[dispute.status] ?? 'secondary'}
              className="capitalize"
            >
              {dispute.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Opened {formatDate(dispute.created_at)} · Order{' '}
            <button
              className="font-mono underline hover:no-underline"
              onClick={() => router.push(ROUTES.order(dispute.order_id))}
            >
              {dispute.order_id.slice(0, 12)}…
            </button>
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Raised By</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {dispute.raised_by}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="mt-1 text-sm font-medium capitalize">{dispute.reason.replace(/_/g, ' ')}</p>
          </CardContent>
        </Card>
        {dispute.resolved_at && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Resolved</p>
              <p className="mt-1 text-sm">{formatDate(dispute.resolved_at)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground leading-relaxed">{dispute.description}</p>
        </CardContent>
      </Card>

      {/* Evidence */}
      {dispute.evidence_urls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {dispute.evidence_urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary"
                >
                  <img
                    src={url}
                    alt={`Evidence ${i + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <ExternalLink className="absolute hidden h-5 w-5 text-white group-hover:block" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolution — only if open */}
      {isOpen && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Resolve Dispute</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-3 flex-wrap">
              <Select
                value={decision}
                onValueChange={(v) => setDecision(v as ResolveDisputePayload['decision'])}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select decision…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="release_to_vendor">Release to Vendor</SelectItem>
                  <SelectItem value="refund_to_customer">Refund to Customer</SelectItem>
                  <SelectItem value="split">Split Payment</SelectItem>
                </SelectContent>
              </Select>
              {decision === 'split' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Vendor %</span>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    value={splitPct}
                    onChange={(e) => setSplitPct(e.target.value)}
                    className="w-20"
                  />
                </div>
              )}
            </div>
            <Textarea
              placeholder="Reason for decision (required)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <div>
              <Button
                disabled={!decision || !reason.trim()}
                onClick={() => {
                  setConfirmText('')
                  setConfirmOpen(true)
                }}
              >
                Resolve Dispute
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolved info */}
      {!isOpen && dispute.resolution && (
        <Card>
          <CardHeader>
            <CardTitle>Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{dispute.resolution}</p>
            {dispute.resolved_by && (
              <p className="mt-2 text-xs text-muted-foreground">
                Resolved by {dispute.resolved_by}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Resolution</DialogTitle>
            <DialogDescription>
              This action will resolve the dispute and trigger payment disbursement. Type{' '}
              <strong className="text-destructive">CONFIRM</strong> to proceed.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Type CONFIRM"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={resolving}>
              Cancel
            </Button>
            <Button
              disabled={confirmText !== 'CONFIRM' || resolving}
              onClick={handleResolve}
            >
              {resolving ? 'Resolving…' : 'Confirm Resolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
