'use client'

import { useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, StarRating, Textarea } from '@avdan/ui'
import type { SubmitReviewsInput } from '@avdan/types'

import { useOrderReviews, useSubmitReviews } from '../hooks/use-reviews'

interface Draft {
  rating: number
  comment: string
}
const EMPTY: Draft = { rating: 0, comment: '' }

/** "How was your order?" — appears once an order has ended (delivered, completed, refunded,
 *  cancelled…). Each product and the vendor can be rated once; anything already rated is shown
 *  read-only. Renders nothing while the order isn't reviewable yet. */
export function OrderReviewCard({ orderId }: { orderId: string }) {
  const { data, isLoading } = useOrderReviews(orderId)
  const submit = useSubmitReviews(orderId)
  const [vendor, setVendor] = useState<Draft>(EMPTY)
  const [products, setProducts] = useState<Record<string, Draft>>({})

  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (!data || !data.eligible) return null

  const draft = (id: string): Draft => products[id] ?? EMPTY
  const pending = data.products.filter((p) => !p.review)
  const vendorPending = !data.vendor
  const nothingLeft = pending.length === 0 && !vendorPending

  const productReviews = pending
    .filter((p) => draft(p.product_id).rating > 0)
    .map((p) => ({
      product_id: p.product_id,
      rating: draft(p.product_id).rating,
      comment: draft(p.product_id).comment.trim() || null,
    }))
  const chosen: SubmitReviewsInput = {
    vendor: vendorPending && vendor.rating > 0 ? { rating: vendor.rating, comment: vendor.comment.trim() || null } : null,
    products: productReviews,
  }
  const canSubmit = !!chosen.vendor || productReviews.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{nothingLeft ? 'Your review' : 'How was your order?'}</CardTitle>
        {!nothingLeft && (
          <p className="text-sm text-muted-foreground">
            Your honest feedback helps other customers and helps vendors improve.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Vendor */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{data.vendor_name ?? 'The vendor'}</p>
          {data.vendor ? (
            <ReviewedRow rating={data.vendor.rating} comment={data.vendor.comment} />
          ) : (
            <DraftRow
              label={`Rate ${data.vendor_name ?? 'the vendor'}`}
              value={vendor}
              onChange={setVendor}
              placeholder="How was the service, packaging and delivery? (optional)"
            />
          )}
        </div>

        {/* Products */}
        {data.products.map((p) => (
          <div key={p.product_id} className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">{p.product_name}</p>
            {p.review ? (
              <ReviewedRow rating={p.review.rating} comment={p.review.comment} />
            ) : (
              <DraftRow
                label={`Rate ${p.product_name}`}
                value={draft(p.product_id)}
                onChange={(d) => setProducts((cur) => ({ ...cur, [p.product_id]: d }))}
                placeholder="What did you think of this product? (optional)"
              />
            )}
          </div>
        ))}

        {!nothingLeft && (
          <div className="flex justify-end">
            <Button disabled={!canSubmit || submit.isPending} onClick={() => submit.mutate(chosen)}>
              {submit.isPending ? 'Saving…' : 'Submit review'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReviewedRow({ rating, comment }: { rating: number; comment: string | null }) {
  return (
    <div className="space-y-1">
      <StarRating value={rating} size={16} />
      {comment && <p className="text-sm text-muted-foreground">{comment}</p>}
    </div>
  )
}

function DraftRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: Draft
  onChange: (d: Draft) => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      <StarRating value={value.rating} size={24} label={label} onChange={(rating) => onChange({ ...value, rating })} />
      {value.rating > 0 && (
        <Textarea
          rows={2}
          maxLength={1000}
          value={value.comment}
          placeholder={placeholder}
          aria-label={`${label} — comment`}
          onChange={(e) => onChange({ ...value, comment: e.target.value })}
        />
      )}
    </div>
  )
}
