'use client'

import { useCallback, useEffect, useState } from 'react'

// Snoozing the nudge is a nicety, not a security boundary — localStorage is fine here, unlike
// auth tokens which must never live there. Keyed so it can't collide with anything else.
const STORAGE_KEY = 'avdan_vendor_payout_nudge_dismissed_until'
const SNOOZE_MS = 24 * 60 * 60 * 1000

/**
 * Tracks whether the vendor payout-account nudge banner was recently dismissed.
 *
 * A dismissal snoozes the banner for ~24h (not forever) — per §5 of STATUS_DESIGN.md the nudge
 * should reappear at most once a day until the account is actually linked, then never again. The
 * "never again once linked" half of that contract is handled by the caller: it simply stops
 * rendering the banner once `has_payout_account` is true, so there is nothing to un-dismiss here.
 */
export function usePayoutNudgeDismissal() {
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      setDismissedUntil(raw ? Number(raw) : null)
    } catch {
      // Storage unavailable (privacy mode, disabled cookies/storage) — fail open, never let a
      // storage error silently block the nudge from ever showing.
    } finally {
      setHydrated(true)
    }
  }, [])

  const dismiss = useCallback(() => {
    const until = Date.now() + SNOOZE_MS
    try {
      window.localStorage.setItem(STORAGE_KEY, String(until))
    } catch {
      // Best effort — if storage is unavailable the nudge will simply reappear next load.
    }
    setDismissedUntil(until)
  }, [])

  const isSnoozed = dismissedUntil !== null && Date.now() < dismissedUntil

  return { isSnoozed, hydrated, dismiss }
}
