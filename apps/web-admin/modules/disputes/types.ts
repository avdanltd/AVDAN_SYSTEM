export interface AdminDispute {
  id: string
  order_id: string
  raised_by: string
  reason: string
  description: string
  evidence_urls: string[]
  status: string
  resolution: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface ResolveDisputePayload {
  decision: 'release_to_vendor' | 'refund_to_customer' | 'split'
  reason: string
  split_percentage?: number
}
