import { useCallback, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'

// Snoozing the nudge is a per-device UI preference, not sensitive data — reusing SecureStore
// (already a dependency via @avdan/mobile's token storage) avoids pulling in AsyncStorage just
// for one timestamp.
const STORAGE_KEY = 'avdan_vendor_payout_nudge_dismissed_until'
const SNOOZE_MS = 24 * 60 * 60 * 1000

/**
 * Mirrors web-vendor's `usePayoutNudgeDismissal`: a dismissal snoozes the nudge banner for ~24h,
 * not forever. "Never again once the account is linked" is handled by the caller — it stops
 * rendering the banner once `has_payout_account` is true.
 */
export function usePayoutNudgeDismissal() {
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return
        setDismissedUntil(raw ? Number(raw) : null)
      })
      .catch(() => {
        // Fail open — never let a storage error permanently hide (or permanently show) the nudge.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = useCallback(() => {
    const until = Date.now() + SNOOZE_MS
    setDismissedUntil(until)
    SecureStore.setItemAsync(STORAGE_KEY, String(until)).catch(() => {})
  }, [])

  const isSnoozed = dismissedUntil !== null && Date.now() < dismissedUntil

  return { isSnoozed, hydrated, dismiss }
}
