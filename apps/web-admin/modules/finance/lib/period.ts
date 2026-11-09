import type { Period } from '../services/finance.service'

export type PresetKey = '24h' | '7d' | '30d' | 'custom'

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '1 week' },
  { key: '30d', label: '1 month' },
  { key: 'custom', label: 'Pick dates' },
]

const HOURS: Record<Exclude<PresetKey, 'custom'>, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }

/** Nigeria is UTC+1 all year, so a From/To date means that day in Lagos time. */
const LAGOS = '+01:00'

export function todayLagos(now = new Date()): string {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * The period to ask the API for. Presets run back from `anchor` (the moment they were chosen or
 * refreshed, so the query key stays stable between renders); custom dates cover whole Lagos days,
 * both ends included.
 */
export function toPeriod(preset: PresetKey, from: string, to: string, anchor: number): Period | null {
  if (preset !== 'custom') {
    return {
      start: new Date(anchor - HOURS[preset] * 3_600_000).toISOString(),
      end: new Date(anchor).toISOString(),
    }
  }
  if (!from || !to || from > to) return null
  return {
    start: new Date(`${from}T00:00:00.000${LAGOS}`).toISOString(),
    end: new Date(`${to}T23:59:59.999${LAGOS}`).toISOString(),
  }
}

export function periodLabel(preset: PresetKey, from: string, to: string): string {
  if (preset === 'custom') return from && to ? `${from} to ${to}` : 'Choose From and To dates'
  return `Last ${PRESETS.find((p) => p.key === preset)?.label.toLowerCase()}`
}
