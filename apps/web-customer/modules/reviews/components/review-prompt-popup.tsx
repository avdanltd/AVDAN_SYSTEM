'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'

import { Button } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { usePendingReviews } from '../hooks/use-reviews'

const SNOOZE_KEY = 'avdan_review_snooze'
const SNOOZE_MS = 24 * 60 * 60 * 1000 // "Remind me later" → ask again tomorrow

function readSnoozes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function snooze(orderId: string): void {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ ...readSnoozes(), [orderId]: Date.now() + SNOOZE_MS }))
  } catch {
    /* private mode — it will simply ask again next visit */
  }
}

/**
 * Right after the delivery code is handed over (the order becomes delivered and the code pop-up
 * goes away), asks the customer to review the experience. "Review now" opens the order's review
 * form; "Remind me later" hides it for a day. Once reviewed, the API stops listing the order.
 */
export function ReviewPromptPopup() {
  const router = useRouter()
  const { data } = usePendingReviews()
  const [mounted, setMounted] = useState(false)
  const [, bump] = useState(0)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null
  const snoozes = readSnoozes()
  const next = (data ?? []).find((p) => (snoozes[p.order_id] ?? 0) < Date.now())
  if (!next) return null

  const later = () => {
    snooze(next.order_id)
    bump((n) => n + 1)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review your experience"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-2xl border border-primary/30 bg-background p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Star className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-base font-semibold text-foreground">Your order has been delivered</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review this experience{next.vendor_name ? ` with ${next.vendor_name}` : ''} — it helps us serve you better.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            onClick={() => {
              snooze(next.order_id)
              router.push(ROUTES.order(next.order_id))
            }}
          >
            Review now
          </Button>
          <Button variant="ghost" onClick={later}>
            Remind me later
          </Button>
        </div>
      </div>
    </div>
  )
}
