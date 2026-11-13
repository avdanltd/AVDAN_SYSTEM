'use client'

import Link from 'next/link'

import { AttentionAlert } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useAttention } from '../hooks/use-attention'

/**
 * "ACTION NEEDED · n" — everything waiting on staff, summed. Links to the most time-critical
 * section that has something in it (orders with no rider first, then payouts, disputes, vendors
 * and products to approve).
 */
export function ActionNeededAlert() {
  const { data } = useAttention()
  const total = data ? data.dispatch + data.payouts + data.disputes + data.vendors + data.products : 0
  const href = !data
    ? ROUTES.dispatch
    : data.dispatch > 0
      ? ROUTES.dispatch
      : data.payouts > 0
        ? ROUTES.payouts
        : data.disputes > 0
          ? ROUTES.disputes
          : data.vendors > 0
            ? ROUTES.vendors
            : ROUTES.products
  return (
    <AttentionAlert
      count={total}
      label="Action needed"
      noun="item"
      href={href}
      linkAs={Link}
      storageKey="avdan-admin-attention-sound"
    />
  )
}
