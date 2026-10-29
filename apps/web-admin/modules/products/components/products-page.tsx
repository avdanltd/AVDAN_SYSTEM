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
  const [discountOn, setDiscountOn] = useState(false)
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>('PERCENT')
  const [discountInput, setDiscountInput] = useState('')
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
    // Start from the price before any discount (the vendor's own, for a new product), and keep
    // an existing discount ticked and filled in so it can be edited or removed.
    setPriceInput(String((product.compare_at_price_kobo ?? product.price_kobo) / 100))
    setDiscountOn(product.discount_type !== null)
    setDiscountType(product.discount_type ?? 'PERCENT')
    setDiscountInput(
      product.discount_value === null
        ? ''
        : String(product.discount_type === 'FIXED' ? product.discount_value / 100 : product.discount_value),
    )
  }

  const shownKobo = Math.round(Number(priceInput) * 100)
  const priceValid = pricing !== null && Number.isFinite(shownKobo) && shownKobo >= pricing.vendor_price_kobo

  // Discount: fixed is entered in naira, percentage as a whole number.
  const discountValue =
    discountType === 'FIXED' ? Math.round(Number(discountInput) * 100) : Math.floor(Number(discountInput))
  const discountEntered = discountOn && Number.isFinite(discountValue) && discountValue > 0
  const discountedKobo = !priceValid
    ? shownKobo
    : !discountEntered
      ? shownKobo
      : discountType === 'PERCENT'
        ? shownKobo - Math.floor((shownKobo * discountValue) / 100)
        : shownKobo - discountValue
  // The vendor is paid in full whatever the discount, so the customer's price can't go below it.
  const maxDiscountKobo = pricing ? shownKobo - pricing.vendor_price_kobo : 0
  const discountValid =
    !discountOn ||
    (discountEntered && (discountType !== 'PERCENT' || discountValue < 100) && pricing !== null && discountedKobo >= pricing.vendor_price_kobo)
  const canSubmit = priceValid && discountValid

  function submitApprove() {
    if (!pricing || !canSubmit) return
    approve.mutate(
      {
        id: pricing.id,
        body: {
          price_kobo: shownKobo,
          ...(discountOn ? { discount_type: discountType, discount_value: discountValue } : {}),
        },
      },
      { onSuccess: () => setPricing(null) },
    )
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
          <span className="text-sm font-medium">
            {naira(row.price_kobo)}
            {row.compare_at_price_kobo ? (
              <span className="ml-1 text-xs text-muted-foreground line-through">{naira(row.compare_at_price_kobo)}</span>
            ) : null}
          </span>
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
              {!priceValid && (
                <p className="text-sm text-destructive">Must be at least {naira(pricing.vendor_price_kobo)}</p>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="add-discount"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={discountOn}
                  onChange={(e) => setDiscountOn(e.target.checked)}
                />
                <Label htmlFor="add-discount">Add a discount (paid for by the platform)</Label>
              </div>

              {discountOn && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={discountType}
                      onValueChange={(v) => {
                        setDiscountType(v as 'FIXED' | 'PERCENT')
                        setDiscountInput('')
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                        <SelectItem value="FIXED">Fixed amount (₦)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="discount-value">{discountType === 'PERCENT' ? 'Percent off' : 'Naira off'}</Label>
                    <Input
                      id="discount-value"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={discountType === 'PERCENT' ? '1' : '0.01'}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {priceValid && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  {discountOn && discountEntered && discountValid ? (
                    <p>
                      Customers pay <span className="font-medium">{naira(discountedKobo)}</span>{' '}
                      <span className="text-muted-foreground line-through">{naira(shownKobo)}</span>
                    </p>
                  ) : (
                    <p>
                      Customers pay <span className="font-medium">{naira(shownKobo)}</span>
                    </p>
                  )}
                  <p className="text-success">
                    Platform gain: {naira((discountOn && discountEntered && discountValid ? discountedKobo : shownKobo) - pricing.vendor_price_kobo)} per unit
                  </p>
                </div>
              )}
              {discountOn && discountEntered && !discountValid && (
                <p className="text-sm text-destructive">
                  {discountType === 'PERCENT' && discountValue >= 100
                    ? 'A percentage discount must be below 100%.'
                    : `Too large: the vendor must still be paid ${naira(pricing.vendor_price_kobo)}. The biggest discount here is ${naira(maxDiscountKobo)}.`}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPricing(null)} disabled={approve.isPending}>
                Cancel
              </Button>
              <Button disabled={!canSubmit || approve.isPending} onClick={submitApprove}>
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
