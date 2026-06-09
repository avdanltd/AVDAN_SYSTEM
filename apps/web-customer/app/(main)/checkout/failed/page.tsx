import Link from 'next/link'
import { ROUTES } from '@/config/routes'

export const metadata = {
  title: 'Payment Failed — AVDAN',
}

export default function CheckoutFailedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-10 w-10 text-red-600">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Payment Failed</h1>
        <p className="text-muted-foreground max-w-sm">
          We could not process your payment. Your cart has been saved — you can try again.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={ROUTES.checkout}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Try Again
        </Link>
        <Link
          href={ROUTES.home}
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
        >
          Back to Shopping
        </Link>
      </div>
    </div>
  )
}
