import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'
import type { OrderStatus, UserRole } from '@avdan/types'

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface StatusConfig {
  label: string
  variant: StatusVariant
  className?: string
}

const ORDER_STATUS_MAP: Record<OrderStatus, StatusConfig> = {
  PENDING:                  { label: 'Pending',           variant: 'secondary' },
  PAID:                     { label: 'Paid',              variant: 'default',     className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  VENDOR_ACCEPTED:          { label: 'Accepted',          variant: 'default',     className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  VENDOR_REJECTED:          { label: 'Rejected',          variant: 'destructive' },
  PREPARING:                { label: 'Preparing',         variant: 'default',     className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  READY_FOR_PICKUP:         { label: 'Ready',             variant: 'default',     className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  PICKED_UP:                { label: 'Picked up',         variant: 'default',     className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  IN_TRANSIT_TO_HUB:        { label: 'In transit',        variant: 'default',     className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  AT_HUB:                   { label: 'At hub',            variant: 'secondary' },
  QA_IN_PROGRESS:           { label: 'QA in progress',    variant: 'default',     className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  QA_PASSED:                { label: 'QA passed',         variant: 'default',     className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  QA_FAILED:                { label: 'QA failed',         variant: 'destructive' },
  VENDOR_REMEDIATION:       { label: 'Remediation',       variant: 'destructive' },
  OUT_FOR_DELIVERY:         { label: 'Out for delivery',  variant: 'default',     className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  DELIVERED:                { label: 'Delivered',         variant: 'default',     className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  FAILED_DELIVERY:          { label: 'Failed delivery',   variant: 'destructive' },
  PAYMENT_RELEASE_PENDING:  { label: 'Release pending',   variant: 'secondary' },
  PAYMENT_RELEASED:         { label: 'Payment released',  variant: 'default',     className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  COMPLETED:                { label: 'Completed',         variant: 'default',     className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  CANCELLED:                { label: 'Cancelled',         variant: 'outline' },
  REFUND_INITIATED:         { label: 'Refund initiated',  variant: 'secondary' },
  DISPUTED:                 { label: 'Disputed',          variant: 'destructive' },
  DISPUTE_RESOLVED:         { label: 'Dispute resolved',  variant: 'secondary' },
}

const USER_STATUS_MAP: Record<string, StatusConfig> = {
  active:    { label: 'Active',    variant: 'default', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  pending:   { label: 'Pending',   variant: 'secondary' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  banned:    { label: 'Banned',    variant: 'destructive' },
}

interface OrderStatusBadgeProps {
  status: OrderStatus
  className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = ORDER_STATUS_MAP[status] ?? { label: status, variant: 'outline' as StatusVariant }
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
