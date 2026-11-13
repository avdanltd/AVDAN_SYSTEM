'use client'

import Link from 'next/link'

import { AttentionAlert } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useRiderOrders } from '../hooks/use-rider-orders'

/**
 * "NEW PICKUP · n" — orders the rider has been assigned but not yet collected: waiting at the
 * vendor (READY_FOR_PICKUP) or cleared by the hub for the final leg (QA_PASSED).
 */
export function NewPickupAlert() {
  const { data } = useRiderOrders()
  const count = (data ?? []).filter((o) => o.status === 'READY_FOR_PICKUP' || o.status === 'QA_PASSED').length
  return (
    <AttentionAlert
      count={count}
      label="New pickup"
      noun="pickup"
      href={ROUTES.orders}
      linkAs={Link}
      storageKey="avdan-rider-pickup-sound"
    />
  )
}
