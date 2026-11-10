'use client'

import { useState } from 'react'
import { Button, Skeleton, StarRating } from '@avdan/ui'

import { useReviews } from '../hooks/use-reviews'
import type { ReviewTarget } from '../services/reviews.service'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Average, a 5→1 breakdown, and the written reviews (newest first). Hidden reviews never appear. */
export function ReviewList({ target, id, title }: { target: ReviewTarget; id: string; title: string }) {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, isFetching } = useReviews(target, id, page)

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">Reviews could not be loaded right now.</p>
  }

  const { summary } = data
  const pages = Math.max(1, Math.ceil(data.total / data.page_size))

  return (
    <section className="space-y-4" aria-labelledby={`reviews-${target}`}>
      <h2 id={`reviews-${target}`} className="text-lg font-semibold text-foreground">
        {title}
      </h2>

      {summary.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet. Customers can review this after their order is delivered.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-4xl font-bold text-foreground">{summary.average.toFixed(1)}</p>
              <StarRating value={summary.average} size={18} />
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.count} review{summary.count === 1 ? '' : 's'}
              </p>
            </div>
            <div className="min-w-[200px] flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = summary.distribution[String(n)] ?? 0
                return (
                  <div key={n} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-3">{n}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${(count / summary.count) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <ul className="divide-y divide-border">
            {data.items.map((r) => (
              <li key={r.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StarRating value={r.rating} size={14} />
                  <span className="text-sm font-medium text-foreground">{r.reviewer_name}</span>
                  <span className="text-xs text-muted-foreground">
                    · Verified purchase · {formatDate(r.created_at)}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages || isFetching} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
