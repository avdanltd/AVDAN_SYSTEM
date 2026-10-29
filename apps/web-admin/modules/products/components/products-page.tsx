'use client'

import { useState } from 'react'
import {
  Badge,
  Button,
  Column,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@avdan/ui'
import { useAdminProducts } from '../hooks/use-admin-products'
import { useReviewProduct } from '../hooks/use-review-product'
import type { AdminProduct } from '../types'
import { Pagination } from '@/modules/shared/components/pagination'

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Awaiting approval' },
  { value: 'APPROVED', label: 'Live' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: '__all__', label: 'All' },
]

const STATUS_VARIANTS: Record<AdminProduct['approval_status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  APPROVED: 'default',
  REJECTED: 'destructive',
}

const STATUS_LABELS: Record<AdminProduct['approval_status'], string> = {
  PENDING: 'Pending',
  APPROVED: 'Live',
  REJECTED: 'Rejected',
}

function naira(kobo: number): string {
  return (kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
}

export function ProductsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('PENDING')
  const [pricing, setPricing] = useState<AdminProduct | null>(null)
  const [rejecting, setRejecting] = useState<AdminProduct | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [reason, setReason] = useState('')

  const params: Record<string, string> = { page: String(page), page_size: '20' }
  if (status !== '__all__') params.approval_status = status

  const { data, isLoading, isError, refetch } = useAdminProducts(params)
  const { approve, reject } = useReviewProduct()

  const products = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data ? Math.ceil(data.total / (data.page_size || 20)) : 1

  function openPricing(product: AdminProduct) {
    setPricing(product)
    // Start from the price already shown (the vendor's own, for a new product).
    setPriceInput(String(product.price_kobo / 100))
  }

  const shownKobo = Math.round(Number(priceInput) * 100)
  const priceValid = pricing !== null && Number.isFinite(shownKobo) && shownKobo >= pricing.vendor_price_kobo

  function submitApprove() {
    if (!pricing || !priceValid) return
    approve.mutate({ id: pricing.id, priceKobo: shownKobo }, { onSuccess: () => setPricing(null) })
  }

  function submitReject() {
    if (!rejecting || reason.trim().length < 3) return
    reject.mutate({ id: rejecting.id, reason: reason.trim() }, { onSuccess: () => setRejecting(null) })
  }

  const columns: Column<AdminProduct>[] = [
    {
      key: 'name',
      header: 'Product',
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.image_urls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.image_urls[0]} alt="" className="h-10 w-10 rounded-md object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-md bg-muted" />
          )}
          <div>
            <p className="font-medium text-foreground">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.category_name ?? 'No category'}</p>
          </div>
        </div>
      ),
    },
    { key: 'vendor', header: 'Vendor', cell: (row) => <span className="text-sm">{row.vendor_name}</span> },
    { key: 'vendor_price', header: 'Vendor price', cell: (row) => <span className="text-sm">{naira(row.vendor_price_kobo)}</span> },
    {
      key: 'price',
      header: 'Shown price',
      cell: (row) =>
        row.approval_status === 'APPROVED' ? (
          <span className="text-sm font-medium">{naira(row.price_kobo)}</span>
        ) : (
          <span className="text-sm text-muted-foreground">Not set</span>
        ),
    },
    {
      key: 'gain',
      header: 'Platform gain',
      cell: (row) =>
        row.approval_status === 'APPROVED' ? (
          <span className="text-sm text-success">{naira(row.markup_kobo)}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <div>
          <Badge variant={STATUS_VARIANTS[row.approval_status]}>{STATUS_LABELS[row.approval_status]}</Badge>
          {row.approval_status === 'REJECTED' && row.rejection_reason && (
            <p className="mt-1 max-w-48 text-xs text-muted-foreground">{row.rejection_reason}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => openPricing(row)}>
            {row.approval_status === 'APPROVED' ? 'Change price' : 'Review'}
          </Button>
          {row.approval_status !== 'REJECTED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRejecting(row)
                setReason('')
              }}
            >
              Reject
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Products</h1>
        <p className="text-sm text-muted-foreground">
          {total} products. Set the price customers see; the difference from the vendor&apos;s price is the platform&apos;s gain.
        </p>
      </div>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
      >
        <SelectTrigger className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="rounded-lg border border-border bg-background shadow-card">
        <DataTable
          columns={columns}
          data={products}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          error={isError}
          errorMessage="Couldn't load products."
          onRetry={() => refetch()}
          emptyMessage={status === 'PENDING' ? 'Nothing is waiting for approval.' : 'No products found.'}
        />
        <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
      </div>

      {pricing && (
        <Dialog open onOpenChange={(o) => !o && setPricing(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{pricing.approval_status === 'APPROVED' ? 'Change shown price' : 'Approve product'}</DialogTitle>
              <DialogDescription>
                {pricing.name} · {pricing.vendor_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm">
                Vendor price: <span className="font-medium">{naira(pricing.vendor_price_kobo)}</span>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="shown-price">Price customers will see (₦)</Label>
                <Input
                  id="shown-price"
                  type="number"
                  inputMode="decimal"
                  min={pricing.vendor_price_kobo / 100}
                  step="0.01"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                />
              </div>
              <p className={`text-sm ${priceValid ? 'text-success' : 'text-destructive'}`}>
                {priceValid
                  ? `Platform gain: ${naira(shownKobo - pricing.vendor_price_kobo)} per unit`
                  : `Must be at least ${naira(pricing.vendor_price_kobo)}`}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPricing(null)} disabled={approve.isPending}>
                Cancel
              </Button>
              <Button disabled={!priceValid || approve.isPending} onClick={submitApprove}>
                {approve.isPending ? 'Saving…' : pricing.approval_status === 'APPROVED' ? 'Save price' : 'Approve & go live'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {rejecting && (
        <Dialog open onOpenChange={(o) => !o && setRejecting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reject product</DialogTitle>
              <DialogDescription>
                {rejecting.name} · {rejecting.vendor_name}. The vendor will see this reason and can edit and resubmit.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Reason (required)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejecting(null)} disabled={reject.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={reason.trim().length < 3 || reject.isPending}
                onClick={submitReject}
              >
                {reject.isPending ? 'Saving…' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
