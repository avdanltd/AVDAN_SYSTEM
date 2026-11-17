export type RangePreset = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom'

export const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Pick dates' },
]

/** Today's date in Lagos (YYYY-MM-DD) — the calendar the team works in, whatever the laptop's zone. */
export function lagosToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(now)
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The inclusive [from, to] dates for a preset ('' = unbounded). 'custom' is handled by the caller. */
export function presetRange(preset: RangePreset, today = lagosToday()): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: shift(today, -6), to: today }
    case '30d':
      return { from: shift(today, -29), to: today }
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today }
    default:
      return { from: '', to: '' }
  }
}
