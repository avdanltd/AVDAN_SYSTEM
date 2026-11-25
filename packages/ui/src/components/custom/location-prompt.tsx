'use client'

import { Loader2, LocateFixed } from 'lucide-react'

import { cn } from '../../lib/utils'

interface LocationPromptProps {
  /** The instruction shown next to the pointing finger, e.g. "Click here to calculate your delivery fee…". */
  instruction: string
  /** What the button says before / after the location is captured. */
  buttonLabel?: string
  updateLabel?: string
  /** True once a location is held; the button then stops blinking and turns calm. */
  captured: boolean
  /** Short confirmation shown once captured, e.g. "Location saved". */
  capturedText?: string
  loading?: boolean
  onClick: () => void
  className?: string
}

/**
 * The "use my current location" call-to-action. It is deliberately loud: people skip over a plain
 * outline button, and without a location the delivery fee can't be priced / a rider can't find the
 * pickup. The button blinks red until a location is captured (still for "reduce motion").
 */
export function LocationPrompt({
  instruction,
  buttonLabel = 'Use my current location',
  updateLabel = 'Update my location',
  captured,
  capturedText = 'Location saved',
  loading = false,
  onClick,
  className,
}: LocationPromptProps) {
  return (
    <div
      className={cn(
        'rounded-lg border-2 p-3',
        captured ? 'border-success/40 bg-success/5' : 'border-destructive/50 bg-destructive/5',
        className,
      )}
    >
      <p className="mb-2 flex items-start gap-2 text-sm font-semibold text-foreground">
        <span aria-hidden className="text-lg leading-none">👉</span>
        <span>{instruction}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onClick}
          disabled={loading}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold shadow-sm transition-opacity disabled:opacity-70',
            captured
              ? 'border border-border bg-background text-foreground'
              : 'bg-destructive text-destructive-foreground motion-safe:animate-pulse',
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {loading ? 'Locating…' : captured ? updateLabel : buttonLabel}
        </button>
        {captured && <span className="text-sm font-medium text-success">{capturedText}</span>}
      </div>
    </div>
  )
}
