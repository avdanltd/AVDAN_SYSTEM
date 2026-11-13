'use client'

import Link from 'next/link'

import { AttentionAlert } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useAttention } from '../hooks/use-attention'

/** "NEW ORDER · n" — paid orders waiting for the vendor to accept. Opens Orders (New tab). */
export function NewOrderAlert() {
  const { data } = useAttention()
  return (
    <AttentionAlert
      count={data?.orders ?? 0}
      label="New order"
      noun="order"
      href={ROUTES.orders}
      linkAs={Link}
      storageKey="avdan-vendor-order-sound"
    />
  )
}
