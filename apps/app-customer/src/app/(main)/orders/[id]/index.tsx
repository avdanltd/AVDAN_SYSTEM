import { useLocalSearchParams } from 'expo-router'
import { OrderDetail } from '@/modules/shop/components/order-detail'
import { SignInGate } from '@/modules/shop/components/sign-in-gate'

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <SignInGate action="view this order">
      <OrderDetail orderId={id} />
    </SignInGate>
  )
}
