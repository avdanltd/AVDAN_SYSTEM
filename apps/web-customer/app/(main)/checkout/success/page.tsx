import Link from 'next/link'
import { ROUTES } from '@/config/routes'

export const metadata = {
  title: 'Payment Successful — AVDAN',
}

export default function CheckoutSuccessPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-10 w-10 text-green-600">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Payment Successful!</h1>
        <p className="text-muted-foreground max-w-sm">
          Your order has been placed and payment confirmed. You can track your order status below.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={ROUTES.orders}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          View My Orders
        </Link>
        <Link
          href={ROUTES.home}
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}
