'use client'

import { cn } from '@avdan/ui'
import { usePendingDeliveryCodes } from '../hooks/use-pending-delivery-codes'

/**
 * A blinking red marker shown next to "My Orders" (and on the account avatar) while a rider is
 * waiting for the customer's delivery code. Renders nothing when there is none.
 */
export function DeliveryCodeBadge({
  className,
  showCount = true,
}: {
  className?: string
  showCount?: boolean
}) {
  const { data } = usePendingDeliveryCodes()
  const count = data?.length ?? 0
  if (count === 0) return null

  return (
    <span
      role="status"
      aria-label={`${count} delivery code${count === 1 ? '' : 's'} to give your rider`}
      className={cn(
        'avdan-animate-blink inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-none text-destructive-foreground',
        !showCount && 'h-2.5 min-w-2.5 px-0',
        className,
      )}
    >
      {showCount ? count : null}
    </span>
  )
}
