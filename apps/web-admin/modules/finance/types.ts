export type FinanceKind = 'vendor' | 'rider' | 'customer'

/** Money split of a set of orders. Customers' payment = vendors + riders + AVDAN. */
export interface FinanceTotals {
  orders: number
  customer_paid_kobo: number
  vendors_kobo: number
  riders_kobo: number
  avdan_product_kobo: number
  avdan_delivery_kobo: number
  avdan_total_kobo: number
}

export interface FinanceSummary {
  start: string
  end: string
  /** Orders whose payment was released in the period: what has actually been earned. */
  released: FinanceTotals
  /** Orders paid for in the period but not yet released (still in escrow). */
  pending: FinanceTotals
  payouts: {
    paid_out_kobo: number
    vendors_paid_out_kobo: number
    riders_paid_out_kobo: number
    awaiting_payout_kobo: number
  }
}

export interface PendingOrder {
  order_id: string
  status: string
  paid_at: string | null
  customer_name: string | null
  vendor_name: string | null
  customer_paid_kobo: number
  vendor_kobo: number
  rider_kobo: number
  avdan_kobo: number
}

export interface PendingRelease {
  totals: FinanceTotals
  orders: PendingOrder[]
}

/** One row of the vendors / riders / customers tables. Customers use spent_kobo, others earned_kobo. */
export interface PersonRow {
  user_id: string
  name: string
  email: string | null
  orders: number
  earned_kobo?: number
  spent_kobo?: number
  /** Paid but not yet released. */
  pending_kobo: number
  paid_out_kobo?: number
  /** What a vendor / rider is owed right now (wallet balance plus withdrawals in flight). */
  balance_kobo?: number
}

export interface PersonOrderLine {
  order_id: string
  status: string
  state: 'released' | 'pending'
  date: string | null
  amount_kobo: number
  customer_paid_kobo: number
}

export interface PersonDetail {
  kind: FinanceKind
  user_id: string
  name: string
  email: string | null
  start: string
  end: string
  released_kobo: number
  pending_kobo: number
  orders: number
  paid_out_kobo: number
  balance_kobo: number
  order_lines: PersonOrderLine[]
  truncated: boolean
}
