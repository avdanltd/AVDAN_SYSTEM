'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Card, CardContent, EmptyState, OrderStatusBadge, Separator, Skeleton } from '@avdan/ui'
import { CheckCircle2, Package, ShoppingBag, Truck, XCircle } from 'lucide-react'
import { useInitiatePayment, useVerifyPayment } from '../hooks/use-checkout'
import { useOrder } from '@/modules/orders/hooks/use-order'
import { ROUTES } from '@/config/routes'

function formatPrice(kobo: number): string {
  return (kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
}

export function CheckoutSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')

  const { mutate: verifyPayment, data: verified, isPending: isVerifying, isError: verifyFailed } = useVerifyPayment()
  const verifyStarted = useRef(false)

  useEffect(() => {
    if (!reference || verifyStarted.current) return
    verifyStarted.current = true
    verifyPayment(reference)
  }, [reference, verifyPayment])

  const { data: order, isLoading: isLoadingOrder } = useOrder(verified?.order_id ?? '')
  const { mutate: retryPayment, isPending: isRetrying } = useInitiatePayment()

  function handleRetry() {
    if (!verified?.order_id) return
    retryPayment(verified.order_id, {
      onSuccess: (payment) => {
        window.location.href = payment.payment_url
      },
    })
  }

  // No reference in the URL at all — someone navigated here directly rather than via a Paystack
  // redirect. Nothing to verify.
  if (!reference) {
    return (
      <div className="mx-auto max-w-md py-10">
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No payment to confirm"
          description="This page confirms a payment after checkout. If you're looking for an order, check your order history."
          action={{ label: 'View orders', onClick: () => router.push(ROUTES.orders) }}
        />
      </div>
    )
  }

  if (isVerifying || (!verified && !verifyFailed)) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <Skeleton className="mx-auto h-16 w-16 rounded-full" />
        <Skeleton className="mx-auto h-6 w-56" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  // Never trust the redirect alone — a customer can land back on this URL whether or not they
  // actually paid, so `paid` (from the server-verified reference) decides what's shown, not the
  // mere fact that Paystack sent them here.
  if (verifyFailed || !verified) {
    return (
      <div className="mx-auto max-w-md py-10">
        <EmptyState
          icon={<XCircle className="h-6 w-6" />}
          title="Couldn't confirm this payment"
          description="We couldn't verify this payment reference. If you were charged, it will reflect on your order shortly — check your order history."
          action={{ label: 'View orders', onClick: () => router.push(ROUTES.orders) }}
        />
      </div>
    )
  }

  if (!verified.paid) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Payment not completed</h1>
          <p className="mx-auto max-w-sm text-muted-foreground">
            Your order is saved but payment wasn't confirmed. You can try again — nothing has been
            charged twice.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={handleRetry} disabled={isRetrying} size="lg">
            {isRetrying ? 'Redirecting…' : 'Try Again'}
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={ROUTES.order(verified.order_id)}>View Order</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Paid — verified. Waiting on the order's own details to render the receipt.
  if (isLoadingOrder || !order) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <Skeleton className="mx-auto h-16 w-16 rounded-full" />
        <Skeleton className="mx-auto h-6 w-56" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-10 text-center">
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <div className="avdan-animate-celebrate-ring absolute inset-0 rounded-full bg-success/25" />
        <div className="avdan-animate-celebrate relative flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={2.5} />
        </div>
      </div>

      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">Order confirmed!</h1>
        <p className="mx-auto max-w-sm text-muted-foreground">
          Payment received — {order.vendor_name ?? 'your vendor'} has been notified and is
          preparing your order.
        </p>
      </div>

      <Card className="text-left">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          <Separator />
          {order.items?.map((item) => (
            <div key={item.id} className="flex justify-between gap-2 text-sm">
              <span className="flex-1 text-foreground">
                {item.product_name} <span className="text-muted-foreground">×{item.quantity}</span>
              </span>
              <span className="shrink-0 font-medium">{formatPrice(item.subtotal_kobo)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Delivery fee</span>
            <span>{formatPrice(order.delivery_fee_kobo)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total paid</span>
            <span>{formatPrice(order.total_kobo + order.delivery_fee_kobo)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button size="lg" asChild>
          <Link href={ROUTES.orderTrack(order.id)}>
            <Truck className="mr-1.5 h-4 w-4" />
            Track Order
          </Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link href={ROUTES.products}>
            <ShoppingBag className="mr-1.5 h-4 w-4" />
            Continue Shopping
          </Link>
        </Button>
      </div>
    </div>
  )
}
