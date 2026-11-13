'use client'

import Link from 'next/link'

import { AttentionAlert } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useAttention } from '../hooks/use-attention'

/** "NEW PARCEL · n" — parcels at this hub that have arrived or are mid-QA and need a person. */
export function NewParcelAlert() {
  const { data } = useAttention()
  return (
    <AttentionAlert
      count={data?.orders ?? 0}
      label="New parcel"
      noun="parcel"
      href={ROUTES.incoming}
      linkAs={Link}
      storageKey="avdan-hub-parcel-sound"
    />
  )
}
