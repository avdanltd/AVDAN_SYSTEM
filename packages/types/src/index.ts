export type * from './generated'

// Hand-written types that supplement the generated API types

export type UserRole = 'customer' | 'vendor' | 'rider' | 'agent' | 'admin' | 'support'

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'VENDOR_ACCEPTED'
  | 'VENDOR_REJECTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT_TO_HUB'
  | 'ARRIVED_AT_HUB'
  | 'AT_HUB'
  | 'QA_IN_PROGRESS'
  | 'QA_PASSED'
  | 'QA_FAILED'
  | 'VENDOR_REMEDIATION'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED_DELIVERY'
  | 'PAYMENT_RELEASE_PENDING'
  | 'PAYMENT_RELEASED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_INITIATED'
  | 'DISPUTED'
  | 'DISPUTE_RESOLVED'

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface HealthResponse {
  status: string
  environment: string
}

// Wallet / payouts — aliases over the generated schemas so apps never restate them.
import type { components } from './generated'

export type WalletSummary = components['schemas']['WalletSummaryResponse']
export type WalletEntry = components['schemas']['WalletEntryResponse']
export type PayoutRequest = components['schemas']['PayoutRequestResponse']
export type PayoutEvent = components['schemas']['PayoutEventResponse']
export type DeliveryQuote = components['schemas']['DeliveryQuoteResponse']
export type PayoutStatus = 'REQUESTED' | 'PROCESSING' | 'PAID' | 'REJECTED' | 'FAILED'
export type IncomingDelivery = components['schemas']['IncomingDeliveryResponse']
export type TrackingStage = 'to_vendor' | 'to_hub' | 'to_customer' | 'at_hub'
