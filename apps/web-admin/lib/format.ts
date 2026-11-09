export function formatKobo(kobo: number): string {
  const naira = kobo / 100
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    // Whole amounts read ₦3,725; anything with kobo always shows both decimals (₦3,724.40, not ₦3,724.4).
    minimumFractionDigits: Number.isInteger(naira) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(naira)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
