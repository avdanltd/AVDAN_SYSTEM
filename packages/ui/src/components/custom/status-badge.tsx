import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'
import type { OrderStatus } from '@avdan/types'

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface StatusConfig {
  label: string
  variant: StatusVariant
  className?: string
}

// Semantic tokens (success/warning/info, each with a `-muted` background), not literal Tailwind
// palette classes (`bg-green-100` etc.) — those hardcode a light-mode-only pastel that never
// adapts under `prefers-color-scheme: dark` / `[data-theme="dark"]`, so every status pill on
// every web app looked washed-out and out of place on a dark background before this fix.
const infoBadge = 'bg-info-muted text-info hover:bg-info-muted'
const successBadge = 'bg-success-muted text-success hover:bg-success-muted'
const warningBadge = 'bg-warning-muted text-warning hover:bg-warning-muted'

const ORDER_STATUS_MAP: Record<OrderStatus, StatusConfig> = {
  PENDING:                  { label: 'Pending',           variant: 'secondary' },
  PAID:                     { label: 'Paid',              variant: 'default',     className: infoBadge },
  VENDOR_ACCEPTED:          { label: 'Accepted',          variant: 'default',     className: successBadge },
  VENDOR_REJECTED:          { label: 'Rejected',          variant: 'destructive' },
  PREPARING:                { label: 'Preparing',         variant: 'default',     className: warningBadge },
  READY_FOR_PICKUP:         { label: 'Ready',             variant: 'default',     className: successBadge },
  PICKED_UP:                { label: 'Picked up',         variant: 'default',     className: infoBadge },
  IN_TRANSIT_TO_HUB:        { label: 'In transit',        variant: 'default',     className: infoBadge },
  ARRIVED_AT_HUB:           { label: 'Arrived at hub',    variant: 'secondary' },
  AT_HUB:                   { label: 'At hub',            variant: 'secondary' },
  QA_IN_PROGRESS:           { label: 'QA in progress',    variant: 'default',     className: warningBadge },
  QA_PASSED:                { label: 'QA passed',         variant: 'default',     className: successBadge },
  QA_FAILED:                { label: 'QA failed',         variant: 'destructive' },
  VENDOR_REMEDIATION:       { label: 'Remediation',       variant: 'destructive' },
  OUT_FOR_DELIVERY:         { label: 'Out for delivery',  variant: 'default',     className: infoBadge },
  DELIVERED:                { label: 'Delivered',         variant: 'default',     className: successBadge },
  FAILED_DELIVERY:          { label: 'Failed delivery',   variant: 'destructive' },
  PAYMENT_RELEASE_PENDING:  { label: 'Release pending',   variant: 'secondary' },
  PAYMENT_RELEASED:         { label: 'Payment released',  variant: 'default',     className: successBadge },
  COMPLETED:                { label: 'Completed',         variant: 'default',     className: successBadge },
  CANCELLED:                { label: 'Cancelled',         variant: 'outline' },
  REFUND_INITIATED:         { label: 'Refund initiated',  variant: 'secondary' },
  DISPUTED:                 { label: 'Disputed',          variant: 'destructive' },
  DISPUTE_RESOLVED:         { label: 'Dispute resolved',  variant: 'secondary' },
}

const USER_STATUS_MAP: Record<string, StatusConfig> = {
  active:    { label: 'Active',    variant: 'default', className: successBadge },
  pending:   { label: 'Pending',   variant: 'secondary' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  banned:    { label: 'Banned',    variant: 'destructive' },
}

interface OrderStatusBadgeProps {
  status: OrderStatus
  className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config: StatusConfig = ORDER_STATUS_MAP[status] ?? { label: status, variant: 'outline' as StatusVariant }
  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  )
}

interface UserStatusBadgeProps {
  status: string
  className?: string
}

export function UserStatusBadge({ status, className }: UserStatusBadgeProps) {
  const config = USER_STATUS_MAP[status] ?? { label: status, variant: 'outline' as StatusVariant }
  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
