'use client'

import { RefreshCw } from 'lucide-react'
import { Button, Input } from '@avdan/ui'

import { PRESETS, todayLagos, type PresetKey } from '../lib/period'

interface Props {
  preset: PresetKey
  from: string
  to: string
  onPreset: (p: PresetKey) => void
  onFrom: (v: string) => void
  onTo: (v: string) => void
  onRefresh: () => void
}

export function PeriodPicker({ preset, from, to, onPreset, onFrom, onTo, onRefresh }: Props) {
  const today = todayLagos()
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Time period">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={preset === p.key ? 'default' : 'outline'}
            onClick={() => onPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            From
            <Input type="date" value={from} max={to || today} onChange={(e) => onFrom(e.target.value)} className="mt-1 w-40" />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <Input type="date" value={to} min={from} max={today} onChange={(e) => onTo(e.target.value)} className="mt-1 w-40" />
          </label>
        </div>
      )}
      <Button size="sm" variant="ghost" className="gap-1.5 sm:ml-auto" onClick={onRefresh}>
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>
    </div>
  )
}
