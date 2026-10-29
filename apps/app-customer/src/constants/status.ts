import { createStatusLabel } from '@avdan/mobile'

/**
 * Customer-facing wording. A customer cares about one question — where is my order — not about
 * which internal leg it is on. Hub QA and escrow bookkeeping are AVDAN's concerns, so they are
 * described in terms of what it means for the buyer.
 */
const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Awaiting payment',
  PAID: 'Paid',
  VENDOR_ACCEPTED: 'Confirmed by seller',
  PREPARING: 'Being prepared',
  READY_FOR_PICKUP: 'Ready for pickup',
  PICKED_UP: 'On its way',
  IN_TRANSIT_TO_HUB: 'On its way',
  AT_HUB: 'Being checked',
  QA_IN_PROGRESS: 'Being checked',
  QA_PASSED: 'Quality checked',
  QA_FAILED: 'Failed our checks',
  VENDOR_REMEDIATION: 'Seller resolving an issue',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED_DELIVERY: 'Delivery failed',
  // Escrow states mean nothing to a buyer — the parcel is in their hands either way.
  PAYMENT_RELEASE_PENDING: 'Delivered',
  PAYMENT_RELEASED: 'Delivered',
  COMPLETED: 'Completed',
  VENDOR_REJECTED: 'Declined by seller',
  REFUND_INITIATED: 'Refund on the way',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Under review',
  DISPUTE_RESOLVED: 'Review resolved',
}

export const statusLabel = createStatusLabel(CUSTOMER_STATUS_LABELS)

/** Statuses where the customer still has something to do or something to wait for. */
export const OPEN_STATUSES = new Set([
  'PENDING',
  'PAID',
  'VENDOR_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT_TO_HUB',
  'AT_HUB',
  'QA_IN_PROGRESS',
  'QA_PASSED',
  'VENDOR_REMEDIATION',
  'OUT_FOR_DELIVERY',
])
