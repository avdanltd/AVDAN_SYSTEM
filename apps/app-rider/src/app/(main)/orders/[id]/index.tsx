import { useLocalSearchParams } from 'expo-router'

import { OrderDetail } from '@/modules/rider/components/order-detail'

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <OrderDetail orderId={id} />
}
