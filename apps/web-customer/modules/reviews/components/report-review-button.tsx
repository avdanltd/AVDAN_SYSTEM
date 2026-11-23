'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  cn,
  toast,
} from '@avdan/ui'
import { reviewsService } from '../services/reviews.service'

const REASONS = [
  { value: 'offensive', label: 'Offensive or abusive' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'false', label: 'Fake or not about this item' },
  { value: 'other', label: 'Something else' },
]

/** "Report" on a review: required by app-store rules for user-written content. Needs a signed-in user. */
export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('offensive')
  const [details, setDetails] = useState('')
  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: () => reviewsService.report(reviewId, reason, details.trim()),
    onSuccess: (r) => {
      toast.success(r.message)
      setOpen(false)
    },
  })

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true) }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
        aria-label="Report this review"
      >
        <Flag className="h-3 w-3" /> Report
      </button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Report this review</DialogTitle>
              <DialogDescription>Tell us what is wrong. Our team will look at it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  aria-pressed={reason === r.value}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-left text-sm',
                    reason === r.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="More details (optional)" rows={3} maxLength={500} />
            {error && <p className="text-sm text-destructive">{error.message}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={() => mutate()} disabled={isPending}>
                {isPending ? 'Sending…' : 'Send report'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
