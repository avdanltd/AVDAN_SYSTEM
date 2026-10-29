import { createStatusLabel } from '@avdan/mobile'

/**
 * Rider-facing wording for statuses whose raw name describes back-office bookkeeping rather than
 * anything the rider did. Once a rider marks a delivery done the order immediately moves to
 * PAYMENT_RELEASE_PENDING (escrow hold begins) and later to PAYMENT_RELEASED / COMPLETED — none
 * of which mean anything to the person who dropped off the parcel. To them it is delivered.
 */
const RIDER_STATUS_LABELS: Record<string, string> = {
  PAYMENT_RELEASE_PENDING: 'Delivered',
  PAYMENT_RELEASED: 'Delivered',
  COMPLETED: 'Delivered',
  IN_TRANSIT_TO_HUB: 'In transit to hub',
  QA_IN_PROGRESS: 'Hub inspection',
  QA_PASSED: 'Passed inspection',
  QA_FAILED: 'Failed inspection',
  FAILED_DELIVERY: 'Delivery failed',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  AT_HUB: 'At hub',
  PICKED_UP: 'Picked up',
}

export const statusLabel = createStatusLabel(RIDER_STATUS_LABELS)
