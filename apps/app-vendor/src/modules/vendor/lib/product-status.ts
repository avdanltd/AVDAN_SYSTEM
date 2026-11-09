import type { Category, Product } from '../types'

export type StatusFilter = 'all' | 'available' | 'awaiting' | 'rejected' | 'out_of_stock'

/**
 * Which filter a product falls under. The buckets don't overlap: awaiting approval or rejected
 * wins regardless of stock; an approved product is out of stock at 0 units, otherwise available
 * (when switched on). Mirrors web-vendor.
 */
export function statusOf(p: Product): Exclude<StatusFilter, 'all'> | null {
  if (p.approval_status === 'PENDING') return 'awaiting'
  if (p.approval_status === 'REJECTED') return 'rejected'
  if (p.stock_qty <= 0) return 'out_of_stock'
  return p.available ? 'available' : null
}

export function statusCounts(products: Product[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: products.length,
    available: 0,
    awaiting: 0,
    rejected: 0,
    out_of_stock: 0,
  }
  for (const p of products) {
    const s = statusOf(p)
    if (s) counts[s] += 1
  }
  return counts
}

/** Categories parent-first with their sub-categories, labelled "Fashion › Men's shoes". */
export function categoryOptions(categories: Category[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  for (const top of categories.filter((c) => !c.parent_id)) {
    out.push({ id: top.id, label: top.name })
    for (const sub of categories.filter((c) => c.parent_id === top.id)) {
      out.push({ id: sub.id, label: `${top.name} › ${sub.name}` })
    }
  }
  return out
}
