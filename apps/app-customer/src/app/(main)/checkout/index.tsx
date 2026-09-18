import { Checkout } from '@/modules/shop/components/checkout'
import { SignInGate } from '@/modules/shop/components/sign-in-gate'

export default function CheckoutScreen() {
  return (
    <SignInGate action="complete your purchase">
      <Checkout />
    </SignInGate>
  )
}
