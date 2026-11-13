'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, X } from 'lucide-react'

import { Button, SoundToggle, useAlertChime } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { usePendingDeliveryCodes } from '../hooks/use-pending-delivery-codes'

const SEEN_KEY = 'avdan_seen_delivery_codes'

function readSeen(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function writeSeen(ids: string[]): void {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(ids))
  } catch {
    /* private mode — the pop-up just shows again next visit */
  }
}

/**
 * Flashes the customer's delivery code on screen the moment a rider sets off, wherever they are
 * in the store. "Got it" shrinks it to a blinking corner chip that stays until the order is
 * delivered (the API then stops listing the code) — so the code is never buried under My Orders.
 */
export function DeliveryCodePopup() {
  const { data } = usePendingDeliveryCodes()
  const codes = data ?? []
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Chime while the full-size code is on screen so the customer notices it straight away.
  const { soundOn, toggle: toggleSound } = useAlertChime({
    active: mounted && expanded && codes.length > 0,
    storageKey: 'avdan-customer-code-sound',
    repeatMs: 6_000,
  })

  const key = codes.map((c) => c.order_id).join(',')
  useEffect(() => {
    setMounted(true)
  }, [])
  // Open full-size the first time each code shows up in this browser session.
  useEffect(() => {
    if (!mounted || codes.length === 0) return
    const seen = readSeen()
    if (codes.some((c) => !seen.includes(c.order_id))) setExpanded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the code list
  }, [mounted, key])

  if (!mounted || codes.length === 0) return null

  const dismiss = () => {
    writeSeen(Array.from(new Set([...readSeen(), ...codes.map((c) => c.order_id)])))
    setExpanded(false)
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="avdan-animate-blink fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg"
        aria-label="Show your delivery code"
      >
        <KeyRound className="h-4 w-4" />
        Delivery code
        {codes.length === 1 ? `: ${codes[0]?.delivery_code}` : `s (${codes.length})`}
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your delivery code"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-2xl border border-primary/30 bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="avdan-animate-blink h-5 w-5" />
            <h2 className="text-base font-semibold text-foreground">Your rider is on the way</h2>
          </div>
          <div className="flex items-center gap-1">
            <SoundToggle soundOn={soundOn} onToggle={toggleSound} label="Delivery code sound" />
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Give the rider this code only once you have received your order.
        </p>
        <ul className="mt-4 space-y-3">
          {codes.map((c) => (
            <li key={c.order_id} className="rounded-xl bg-primary/5 p-4 text-center">
              {c.vendor_name && <p className="text-xs text-muted-foreground">From {c.vendor_name}</p>}
              <p className="mt-1 font-display text-5xl font-bold tracking-[0.3em] text-primary">
                {c.delivery_code}
              </p>
              <Link
                href={ROUTES.order(c.order_id)}
                onClick={dismiss}
                className="mt-2 inline-block text-xs text-primary underline"
              >
                View order
              </Link>
            </li>
          ))}
        </ul>
        <Button className="mt-5 w-full" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  )
}
