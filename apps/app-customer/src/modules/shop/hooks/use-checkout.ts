import { useState } from 'react'
import * as WebBrowser from 'expo-web-browser'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/mobile'

import { shopService } from '../services/shop.service'
import { useCartStore, type VendorGroup } from '../store/cart.store'
import type { DeliveryAddress } from '../types'

/** The deep link Paystack redirects to. Must match `scheme` in app.config.ts. */
const RETURN_URL = 'avdancustomer://checkout/callback'

export type CheckoutStage = 'idle' | 'creating' | 'paying' | 'verifying'

export interface CheckoutOutcome {
  orderId: string
  paid: boolean
  /** True when the customer closed the browser without us being able to confirm payment. */
  unconfirmed: boolean
}

/**
 * Create an order, take payment, confirm it.
 *
 * Payment opens in `openAuthSessionAsync`, which uses the OS's own hardened browser
 * (SFSafariViewController / Chrome Custom Tab) rather than an in-app WebView. Card details never
 * touch our JavaScript, and it is the pattern Apple and Google expect — a JS-controlled WebView
 * collecting card numbers is the thing to avoid.
 *
 * On return we always call `POST /payment/verify/{reference}` rather than trusting the redirect.
 * The webhook remains the source of truth, but it may not have arrived yet — or at all, if the
 * customer is on a flaky connection. Verifying here means the app can answer "did that work?"
 * immediately, and both paths funnel into the same idempotent server handler.
 */
export function useCheckout() {
  const [stage, setStage] = useState<CheckoutStage>('idle')
  const clearVendor = useCartStore((s) => s.clearVendor)
  const qc = useQueryClient()

  const checkout = async (
    group: VendorGroup,
    address: DeliveryAddress,
  ): Promise<CheckoutOutcome | null> => {
    try {
      setStage('creating')
      const order = await shopService.createOrder({
        vendor_id: group.vendorId,
        items: group.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        delivery_address: address,
      })

      // The order exists from here on. Clearing this vendor's lines now means a customer who
      // abandons payment does not accidentally create a second identical order on retry —
      // they resume from the unpaid order in their order list instead.
      clearVendor(group.vendorId)
      qc.invalidateQueries({ queryKey: ['customer-orders'] })

      setStage('paying')
      const payment = await shopService.initiatePayment(order.id)

      const result = await WebBrowser.openAuthSessionAsync(payment.payment_url, RETURN_URL)

      // `dismiss` means the customer swiped the browser away. That does NOT mean they did not
      // pay — they may have completed the charge and then closed it — so verify regardless.
      setStage('verifying')
      const verified = await shopService.verifyPayment(payment.reference)

      qc.invalidateQueries({ queryKey: ['customer-orders'] })
      qc.invalidateQueries({ queryKey: ['customer-order', order.id] })

      if (verified.paid) {
        toast.success('Payment confirmed', 'Your order has been sent to the vendor.')
        return { orderId: order.id, paid: true, unconfirmed: false }
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
        toast.info('Payment not completed', 'Your order is saved — you can pay for it any time.')
        return { orderId: order.id, paid: false, unconfirmed: true }
      }

      toast.error('Payment not confirmed', 'If you were charged it will update shortly.')
      return { orderId: order.id, paid: false, unconfirmed: true }
    } catch (e) {
      toast.error('Checkout failed', e instanceof Error ? e.message : 'Please try again.')
      return null
    } finally {
      setStage('idle')
    }
  }

  /** Retry payment for an order that already exists but was never paid. */
  const payExistingOrder = async (orderId: string): Promise<CheckoutOutcome | null> => {
    try {
      setStage('paying')
      const payment = await shopService.initiatePayment(orderId)
      const result = await WebBrowser.openAuthSessionAsync(payment.payment_url, RETURN_URL)

      setStage('verifying')
      const verified = await shopService.verifyPayment(payment.reference)

      qc.invalidateQueries({ queryKey: ['customer-orders'] })
      qc.invalidateQueries({ queryKey: ['customer-order', orderId] })

      if (verified.paid) {
        toast.success('Payment confirmed')
        return { orderId, paid: true, unconfirmed: false }
      }
      if (result.type === 'cancel' || result.type === 'dismiss') {
        toast.info('Payment not completed')
      }
      return { orderId, paid: false, unconfirmed: true }
    } catch (e) {
      toast.error('Could not start payment', e instanceof Error ? e.message : 'Please try again.')
      return null
    } finally {
      setStage('idle')
    }
  }

  return { checkout, payExistingOrder, stage, isBusy: stage !== 'idle' }
}
