import { createStatusLabel } from '@avdan/mobile'

/**
 * Vendor-facing wording. A vendor cares about their fulfilment obligation and whether they have
 * been paid — not about which courier leg the parcel is on. Everything between pickup and
 * delivery collapses to "In delivery", and the escrow states become plain money language.
 */
const VENDOR_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Awaiting payment',
  PAID: 'New order',
  VENDOR_ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Awaiting pickup',
  PICKED_UP: 'In delivery',
  IN_TRANSIT_TO_HUB: 'In delivery',
  AT_HUB: 'At hub',
  QA_IN_PROGRESS: 'Hub inspection',
  QA_PASSED: 'Passed inspection',
  QA_FAILED: 'Failed inspection',
  VENDOR_REMEDIATION: 'Action needed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED_DELIVERY: 'Delivery failed',
  PAYMENT_RELEASE_PENDING: 'Payout pending',
  PAYMENT_RELEASED: 'Paid out',
  COMPLETED: 'Completed',
  VENDOR_REJECTED: 'Rejected',
  REFUND_INITIATED: 'Refunded',
  DISPUTED: 'Disputed',
  DISPUTE_RESOLVED: 'Dispute resolved',
}

export const statusLabel = createStatusLabel(VENDOR_STATUS_LABELS)
