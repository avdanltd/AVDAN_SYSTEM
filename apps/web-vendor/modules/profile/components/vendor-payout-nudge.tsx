'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Wallet, X } from 'lucide-react'

import { Button } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { profileService } from '../services/profile.service'
import { usePayoutNudgeDismissal } from '../hooks/use-payout-nudge-dismissal'

/**
 * Post-sign-in nudge asking a vendor without a linked payout account to add one.
 *
 * Spec: STATUS_DESIGN.md §5. A dismissible banner, not a blocking modal — dismissing never
 * disables anything, it just snoozes the reminder for ~24h (see `usePayoutNudgeDismissal`).
 * Mounted once in `app/(main)/layout.tsx` so it shows on every authenticated page, and reuses the
 * same `['vendor-catalog']` query the profile page's Business/Payout forms already run, rather
 * than firing a second fetch for the same field.
 */
export function VendorPayoutNudge() {
  const router = useRouter()

  const { data: vendor } = useQuery({
    queryKey: ['vendor-catalog'],
    queryFn: profileService.getVendorProfile,
  })

  const { isSnoozed, hydrated, dismiss } = usePayoutNudgeDismissal()

  if (!hydrated || !vendor || vendor.has_payout_account || isSnoozed) {
    return null
  }

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-muted p-4 shadow-card animate-in fade-in slide-in-from-top-2"
    >
      <div className="mt-0.5 shrink-0 rounded-full bg-warning/15 p-2 text-warning">
        <Wallet className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          Add your payout account to start receiving payments
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your earnings stay in escrow until a verified bank account is on file.
        </p>
        <div className="mt-3">
          <Button size="sm" onClick={() => router.push(ROUTES.profile)}>
            Set up now
          </Button>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
