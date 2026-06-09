'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  OrderStatusBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Label,
} from '@avdan/ui'
import type { VendorOrder } from '../types'
import { useAcceptOrder } from '../hooks/use-accept-order'
import { useRejectOrder } from '../hooks/use-reject-order'
import { useMarkReady } from '../hooks/use-mark-ready'
import { formatPrice, formatRelativeTime } from '@/lib/format'

interface OrderCardProps {
  order: VendorOrder
}

const REJECT_REASONS = [
  { value: 'product_unavailable', label: 'Product unavailable' },
  { value: 'too_busy', label: 'Too busy right now' },
  { value: 'other', label: 'Other reason' },
] as const

export function OrderCard({ order }: OrderCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [rejectNote, setRejectNote] = useState('')

  const { mutate: accept, isPending: accepting } = useAcceptOrder()
  const { mutate: reject, isPending: rejecting } = useRejectOrder()
  const { mutate: markReady, isPending: markingReady } = useMarkReady()

  const isNew = order.status === 'PAID'
  const isPreparing = order.status === 'VENDOR_ACCEPTED' || order.status === 'PREPARING'
  const isReady = order.status === 'READY_FOR_PICKUP'

  function handleReject() {
    const reason = rejectNote.trim()
      ? `${rejectReason}: ${rejectNote.trim()}`
      : rejectReason
    reject(
      { id: order.id, reason },
      {
        onSuccess: () => {
          setRejectOpen(false)
          setRejectReason('')
          setRejectNote('')
        },
      },
    )
  }

  return (
    <>
      <Card className="flex flex-col border border-border bg-background">
        <CardContent className="flex-1 p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-mono text-xs font-semibold text-foreground">
                #{order.id.slice(0, 8)}
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRelativeTime(order.created_at)}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <ul className="mt-3 space-y-1">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {item.name}
                    <span className="ml-1 text-muted-foreground">×{item.quantity}</span>
                  </span>
                  <span className="text-muted-foreground">{formatPrice(item.price_kobo * item.quantity)}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Customer note */}
          {order.customer_note && (
            <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="font-medium">Note: </span>
              {order.customer_note}
            </div>
          )}

          {/* Total */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-base font-bold text-foreground">{formatPrice(order.total_kobo)}</span>
          </div>
        </CardContent>

        {/* Action footer */}
        {(isNew || isPreparing) && (
          <CardFooter className="gap-2 border-t border-border p-3">
            {isNew && (
              <>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => accept(order.id)}
                  disabled={accepting || rejecting}
                >
                  {accepting ? 'Accepting…' : 'Accept'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => setRejectOpen(true)}
                  disabled={accepting || rejecting}
                >
                  Reject
                </Button>
              </>
            )}
            {isPreparing && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => markReady(order.id)}
                disabled={markingReady}
              >
                {markingReady ? 'Updating…' : 'Mark Ready for Pickup'}
              </Button>
            )}
          </CardFooter>
        )}

        {isReady && (
          <CardFooter className="border-t border-border p-3">
            <p className="w-full text-center text-xs text-green-700">
              Waiting for rider pickup
            </p>
          </CardFooter>
        )}
      </Card>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Order #{order.id.slice(0, 8)}</DialogTitle>
            <DialogDescription>
              Select a reason for rejecting this order. The customer will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason</Label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger id="reject-reason">
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {REJECT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reject-note">Additional note (optional)</Label>
              <Textarea
                id="reject-note"
                placeholder="Any additional details…"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason || rejecting}
            >
              {rejecting ? 'Rejecting…' : 'Reject Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
