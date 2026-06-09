'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'

import {
  OrderStatusBadge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Skeleton,
  EmptyState,
  DataTable,
  Column,
} from '@avdan/ui'
import { useAdminOrder } from '../hooks/use-admin-order'
import { useOverrideStatus } from '../hooks/use-override-status'
import { useSession } from '@/modules/auth/hooks/use-session'
import type { AdminOrderItem } from '../types'
import { formatKobo, formatDate } from '@/lib/format'
import { ROUTES } from '@/config/routes'

const STATUS_OPTIONS = [
  'PENDING', 'PAID', 'VENDOR_ACCEPTED', 'VENDOR_REJECTED',
  'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT_TO_HUB',
  'AT_HUB', 'QA_IN_PROGRESS', 'QA_PASSED', 'QA_FAILED',
  'VENDOR_REMEDIATION', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY',
  'PAYMENT_RELEASE_PENDING', 'PAYMENT_RELEASED', 'COMPLETED',
  'CANCELLED', 'REFUND_INITIATED', 'DISPUTED', 'DISPUTE_RESOLVED',
]

interface OrderDetailPageProps {
  orderId: string
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const router = useRouter()
  const { role } = useSession()
  const { data: order, isLoading } = useAdminOrder(orderId)
  const { mutate: overrideStatus, isPending: overriding } = useOverrideStatus(orderId)

  const [newStatus, setNewStatus] = useState('')
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const itemColumns: Column<AdminOrderItem>[] = [
    { key: 'name', header: 'Product', cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'qty', header: 'Qty', cell: (r) => <span>{r.quantity}</span> },
    {
      key: 'price',
      header: 'Unit Price',
      cell: (r) => <span className="tabular-nums">{formatKobo(r.price_kobo)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      cell: (r) => (
        <span className="tabular-nums font-medium">{formatKobo(r.price_kobo * r.quantity)}</span>
      ),
    },
  ]

  function handleOverride() {
    overrideStatus({ status: newStatus, reason }, {
      onSuccess: () => {
        setConfirmOpen(false)
        setConfirmText('')
        setNewStatus('')
        setReason('')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-6">
        <EmptyState title="Order not found" description="This order does not exist or has been removed." />
      </div>
    )
  }

  const events = order.events ?? []
  const items = order.items ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(ROUTES.orders)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg font-semibold text-foreground">{order.id}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">Created {formatDate(order.created_at)}</p>
        </div>
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="mt-1 font-mono text-sm font-medium">{order.customer_id.slice(0, 12)}…</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Vendor</p>
            <p className="mt-1 font-mono text-sm font-medium">{order.vendor_id.slice(0, 12)}…</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Rider</p>
            <p className="mt-1 font-mono text-sm font-medium">
              {order.rider_id ? `${order.rider_id.slice(0, 12)}…` : 'Unassigned'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Order Total</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatKobo(order.total_kobo)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No items data available.</p>
          ) : (
            <DataTable
              columns={itemColumns}
              data={items}
              keyExtractor={(r) => r.id}
            />
          )}
        </CardContent>
      </Card>

      {/* Delivery Address */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Address</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded bg-secondary p-3 text-xs text-foreground overflow-auto">
            {JSON.stringify(order.delivery_address, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Event Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Order Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded.</p>
          ) : (
            <ol className="relative ml-4 border-l border-border">
              {events.map((event) => (
                <li key={event.id} className="mb-6 ml-6">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex items-center gap-2">
                    {event.from_state && (
                      <>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {event.from_state.replace(/_/g, ' ')}
                        </Badge>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </>
                    )}
                    <Badge className="text-xs capitalize">
                      {event.to_state.replace(/_/g, ' ')}
                    </Badge>
                    {event.actor_role && (
                      <span className="text-xs text-muted-foreground">by {event.actor_role}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <pre className="mt-1 rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
                      {JSON.stringify(event.metadata)}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Admin Override — only for admin role */}
      {(role === 'admin') && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Admin Override</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Manually override the order status. This action is logged and irreversible.
            </p>
            <div className="flex gap-3">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select new status…" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Reason for override (required)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <div>
              <Button
                variant="destructive"
                disabled={!newStatus || !reason.trim()}
                onClick={() => {
                  setConfirmText('')
                  setConfirmOpen(true)
                }}
              >
                Override Status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Override Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Status Override</DialogTitle>
            <DialogDescription>
              This is a manual override and will be logged. Type{' '}
              <strong className="text-destructive">CONFIRM</strong> to proceed.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Type CONFIRM"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={overriding}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== 'CONFIRM' || overriding}
              onClick={handleOverride}
            >
              {overriding ? 'Overriding…' : 'Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
