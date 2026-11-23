import { useRouter } from 'expo-router'
import { AttentionBanner } from '@avdan/mobile'

import { useAttention } from '../hooks/use-vendor'

/** "NEW ORDER · n": paid orders waiting for the vendor to accept. Chimes while the app is open. */
export function NewOrderAlert() {
  const router = useRouter()
  const { data } = useAttention()
  return (
    <AttentionBanner
      count={data?.orders ?? 0}
      label="New order"
      noun="order"
      onPress={() => router.push('/orders')}
      storageKey="avdan_vendor_order_sound"
    />
  )
}
