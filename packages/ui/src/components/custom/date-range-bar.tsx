'use client'

import { PRESETS, type RangePreset } from '@avdan/types'
import { Button } from '../primitives/button'
import { Input } from '../primitives/input'

/** Today / 7 days / 30 days / This month / All time / Pick dates. The page owns the state; this
 * only renders the choices and reports what was picked. Shared by every dashboard that slices
 * numbers by period. */
export function DateRangeBar({
  preset,
  customFrom,
  customTo,
  onPreset,
  onCustomFrom,
  onCustomTo,
}: {
  preset: RangePreset
  customFrom: string
  customTo: string
  onPreset: (p: RangePreset) => void
  onCustomFrom: (v: string) => void
  onCustomTo: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button key={p.value} size="sm" variant={preset === p.value ? 'default' : 'outline'} onClick={() => onPreset(p.value)}>
          {p.label}
        </Button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="From date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => onCustomFrom(e.target.value)}
            className="w-40"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => onCustomTo(e.target.value)}
            className="w-40"
          />
        </div>
      )}
    </div>
  )
}
