import { useLocalSearchParams } from 'expo-router'
import { OrderDetail } from '@/modules/shop/components/order-detail'

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <OrderDetail orderId={id} />
}
