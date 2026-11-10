'use client'

import { useState } from 'react'
import type { AdminReview } from '@avdan/types'

import {
  Badge,
  Button,
  Column,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  StarRating,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@avdan/ui'
import { formatDate } from '@/lib/format'
import { Pagination } from '@/modules/shared/components/pagination'
import { useAdminReviews, useHideReview, useUnhideReview } from '../hooks/use-reviews'

const OUTCOME_LABEL: Record<string, string> = {
  COMPLETED: 'Delivered',
  DELIVERED: 'Delivered',
  PAYMENT_RELEASE_PENDING: 'Delivered',
  PAYMENT_RELEASED: 'Delivered',
  CANCELLED: 'Cancelled',
  VENDOR_REJECTED: 'Rejected by vendor',
  REFUND_INITIATED: 'Refunded',
  DISPUTE_RESOLVED: 'Dispute resolved',
}

export function ReviewsPage() {
  const [status, setStatus] = useState('visible')
  const [target, setTarget] = useState('ALL')
  const [lowOnly, setLowOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [hiding, setHiding] = useState<AdminReview | null>(null)
  const [reason, setReason] = useState('')
  const hide = useHideReview()
  const unhide = useUnhideReview()

  const params: Record<string, string> = { page: String(page), page_size: '20' }
  if (status !== 'ALL') params.status = status
  if (target !== 'ALL') params.target_type = target
  if (lowOnly) params.max_rating = '2'
  const query = useAdminReviews(params)
  const items = query.data?.items ?? []
  const pages = query.data ? Math.ceil(query.data.total / (query.data.page_size || 20)) : 1

  const columns: Column<AdminReview>[] = [
    {
      key: 'rating',
      header: 'Rating',
      cell: (r) => <StarRating value={r.rating} size={14} />,
    },
    {
      key: 'about',
      header: 'About',
      cell: (r) => (
        <div>
          <p className="font-medium text-foreground">
            {r.target_type === 'product' ? (r.product_name ?? 'Product') : (r.vendor_name ?? 'Vendor')}
          </p>
          <p className="text-xs text-muted-foreground">
            {r.target_type === 'product' ? `Product · ${r.vendor_name ?? ''}` : 'Vendor'}
          </p>
        </div>
      ),
    },
    {
      key: 'comment',
      header: 'Review',
      cell: (r) => (
        <div className="max-w-sm">
          <p className="line-clamp-3 text-sm text-foreground">{r.comment ?? <span className="text-muted-foreground">No comment</span>}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.customer_name ?? 'Customer'} · {OUTCOME_LABEL[r.order_outcome] ?? r.order_outcome} ·{' '}
            {formatDate(r.created_at)}
          </p>
          {r.status === 'hidden' && (
            <p className="mt-1 text-xs text-destructive">
              Hidden by {r.hidden_by_name ?? 'an admin'}: {r.hidden_reason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge variant={r.status === 'visible' ? 'secondary' : 'outline'}>{r.status === 'visible' ? 'Visible' : 'Hidden'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      cell: (r) =>
        r.status === 'visible' ? (
          <Button size="sm" variant="outline" onClick={() => { setHiding(r); setReason('') }}>
            Hide
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={unhide.isPending} onClick={() => unhide.mutate(r.id)}>
            Restore
          </Button>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Customer ratings of products and vendors, left after an order ends. Hide anything abusive or
          off-topic — hidden reviews stop counting toward ratings and disappear from the storefront.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <TabsList>
            <TabsTrigger value="visible">Visible</TabsTrigger>
            <TabsTrigger value="hidden">Hidden</TabsTrigger>
            <TabsTrigger value="ALL">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={target} onValueChange={(v) => { setTarget(v); setPage(1) }}>
            <TabsList>
              <TabsTrigger value="ALL">Everything</TabsTrigger>
              <TabsTrigger value="product">Products</TabsTrigger>
              <TabsTrigger value="vendor">Vendors</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant={lowOnly ? 'default' : 'outline'} size="sm" onClick={() => { setLowOnly(!lowOnly); setPage(1) }}>
            {lowOnly ? 'Showing 1–2★ only' : 'Low ratings only'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(r) => r.id}
          loading={query.isLoading}
          error={query.isError}
          errorMessage="Couldn't load reviews."
          onRetry={() => query.refetch()}
          emptyMessage="No reviews here yet."
        />
        <Pagination page={page} pages={pages} total={query.data?.total ?? 0} onPageChange={setPage} />
      </div>

      <Dialog open={hiding !== null} onOpenChange={(open) => !open && setHiding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hide this review?</DialogTitle>
            <DialogDescription>
              It will stop counting toward the rating and disappear from the storefront. You can restore it
              later. Your name is recorded.
            </DialogDescription>
          </DialogHeader>
          {hiding?.comment && <p className="rounded-md bg-secondary p-3 text-sm">{hiding.comment}</p>}
          <Textarea
            rows={3}
            maxLength={500}
            placeholder="Reason (required) — e.g. abusive language, spam, wrong vendor"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setHiding(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3 || hide.isPending}
              onClick={() => hiding && hide.mutate({ id: hiding.id, reason: reason.trim() }, { onSuccess: () => setHiding(null) })}
            >
              {hide.isPending ? 'Hiding…' : 'Hide review'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
