/** One colour per order status group, shared by every chart (hex so it works on web and React Native). */
export const ORDER_GROUP_COLORS: Record<string, string> = {
  pending: '#64748B',
  in_progress: '#3B82F6',
  delivered: '#0E9AA7',
  release_pending: '#F59E0B',
  completed: '#22C55E',
  cancelled: '#EF4444',
  issues: '#A855F7',
}

/** Short axis label for a chart bucket (a day, the Monday of a week, or the first of a month). */
export function bucketLabel(bucket: string, unit: string): string {
  const d = new Date(`${bucket}T00:00:00Z`)
  if (unit === 'month') return d.toLocaleDateString('en-NG', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  const base = d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return unit === 'week' ? `Wk ${base}` : base
}
