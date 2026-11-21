import { useRouter } from 'expo-router'
import { AttentionBanner } from '@avdan/mobile'

import { useRiderOrders } from '../hooks/use-rider-orders'

/**
 * "NEW PICKUP · n": orders the rider has been assigned but not yet collected, either waiting at the
 * vendor (READY_FOR_PICKUP) or cleared by the hub for the final leg (QA_PASSED).
 */
export function NewPickupAlert() {
  const router = useRouter()
  const { data } = useRiderOrders()
  const count = (data ?? []).filter((o) => o.status === 'READY_FOR_PICKUP' || o.status === 'QA_PASSED').length
  return (
    <AttentionBanner
      count={count}
      label="New pickup"
      noun="pickup"
      onPress={() => router.push('/orders')}
      storageKey="avdan_rider_pickup_sound"
    />
  )
}
