export interface AdminDispute {
  id: string
  order_id: string
  raised_by: string
  reason: string
  description: string
  evidence_urls: string[]
  status: string
  resolution: string | null
  resolution_notes: string | null
  resolved_at: string | null
  created_at: string
}

// Matches `ResolveDisputeRequest` in apps/api/services/dispute/schemas.py exactly — the backend
// takes a `resolution` + `notes` pair (not `decision`/`reason`) and, for a split resolution, two
// explicit kobo amounts rather than a percentage.
export interface ResolveDisputePayload {
  resolution: 'release_to_vendor' | 'refund_to_customer' | 'split'
  notes: string
  vendor_amount_kobo?: number
  refund_amount_kobo?: number
}
