/**
 * Format kobo (integer) to Nigerian Naira string.
 * e.g. 250000 → "₦2,500.00"
 */
export function formatPrice(kobo: number): string {
  const naira = kobo / 100
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(naira)
}

/**
 * Format an ISO date string as a relative time string.
 * e.g. "2 min ago", "1 hr ago", "3 days ago"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60)
    return `${m} min ago`
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600)
    return `${h} hr ago`
  }
  const d = Math.floor(diffSec / 86400)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d} days ago`
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

/**
 * Format an ISO date string as a locale date+time string.
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
