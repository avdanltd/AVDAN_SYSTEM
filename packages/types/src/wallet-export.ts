import type { PayoutRequest, WalletEntry } from './index'

/** Date-range choices on the vendor / rider wallet. */
export type WalletRangePreset = 'all' | '24h' | '7d' | '30d' | 'custom'

export const WALLET_RANGE_LABELS: Record<WalletRangePreset, string> = {
  all: 'All time',
  '24h': 'Last 24 hours',
  '7d': 'Last week',
  '30d': 'Last month',
  custom: 'Pick dates',
}

export interface WalletRangeValue {
  preset: WalletRangePreset
  /** yyyy-mm-dd from a date input — only used when preset is "custom". */
  customFrom: string
  customTo: string
}

export const DEFAULT_WALLET_RANGE: WalletRangeValue = { preset: 'all', customFrom: '', customTo: '' }

const HOUR = 3_600_000

/**
 * Turns the picker state into the `date_from` / `date_to` query params the wallet endpoints take.
 * Custom dates are read in the viewer's own timezone: the "to" day is inclusive (end of day).
 */
export function walletRangeParams(
  range: WalletRangeValue,
  now: Date = new Date(),
): { date_from?: string; date_to?: string } {
  switch (range.preset) {
    case '24h':
      return { date_from: new Date(now.getTime() - 24 * HOUR).toISOString() }
    case '7d':
      return { date_from: new Date(now.getTime() - 7 * 24 * HOUR).toISOString() }
    case '30d':
      return { date_from: new Date(now.getTime() - 30 * 24 * HOUR).toISOString() }
    case 'custom': {
      const out: { date_from?: string; date_to?: string } = {}
      const from = range.customFrom ? new Date(`${range.customFrom}T00:00:00`) : null
      const to = range.customTo ? new Date(`${range.customTo}T23:59:59.999`) : null
      if (from && !Number.isNaN(from.getTime())) out.date_from = from.toISOString()
      if (to && !Number.isNaN(to.getTime())) out.date_to = to.toISOString()
      return out
    }
    default:
      return {}
  }
}

/** What happened to a withdrawal and when — shown under its status. Null while it is still waiting. */
export function payoutStamp(r: Pick<PayoutRequest, 'status' | 'paid_at' | 'decided_at'>): {
  label: string
  at: string
} | null {
  if (r.status === 'PAID' && (r.paid_at ?? r.decided_at)) {
    return { label: 'Paid', at: (r.paid_at ?? r.decided_at) as string }
  }
  if (r.status === 'PROCESSING' && r.decided_at) return { label: 'Sending since', at: r.decided_at }
  if (r.status === 'REJECTED' && r.decided_at) return { label: 'Rejected', at: r.decided_at }
  if (r.status === 'FAILED' && r.decided_at) return { label: 'Failed', at: r.decided_at }
  return null
}

const ENTRY_NAMES: Record<string, string> = {
  ORDER_CREDIT: 'Earning added',
  WITHDRAWAL_HOLD: 'Withdrawal requested',
  WITHDRAWAL_RELEASE: 'Returned to available',
  WITHDRAWAL_REVERSAL: 'Transfer failed — returned',
}

const STATUS_NAMES: Record<string, string> = {
  REQUESTED: 'Awaiting approval',
  PROCESSING: 'Sending to bank',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  FAILED: 'Transfer failed',
}

function cell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value)
  // Notes are typed by admins: stop a leading = + - @ from being run as a spreadsheet formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const naira = (kobo: number | null | undefined): string => (kobo == null ? '' : (kobo / 100).toFixed(2))

/**
 * One flat CSV of a wallet: withdrawals first, then ledger activity. Amounts are plain naira
 * numbers (no symbol) so they sum correctly in a spreadsheet; dates are ISO-8601 UTC.
 */
export function walletCsv(requests: PayoutRequest[], entries: WalletEntry[]): string {
  const rows: (string | number | null | undefined)[][] = [
    ['Type', 'Date', 'Activity', 'Status', 'Amount (NGN)', 'Requested (NGN)', 'Approved (NGN)', 'Processing / paid at', 'Note'],
  ]
  for (const r of requests) {
    const stamp = payoutStamp(r)
    rows.push([
      'Withdrawal',
      r.created_at,
      'Withdrawal request',
      STATUS_NAMES[r.status] ?? r.status,
      naira(r.approved_kobo ?? r.requested_kobo),
      naira(r.requested_kobo),
      naira(r.approved_kobo),
      stamp?.at ?? '',
      r.decision_note ?? (r.failure_reason ? 'Bank transfer failed' : ''),
    ])
  }
  for (const e of entries) {
    rows.push(['Wallet activity', e.created_at, ENTRY_NAMES[e.kind] ?? e.kind, '', naira(e.amount_kobo), '', '', '', ''])
  }
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}
