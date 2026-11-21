export interface AdminVendor {
  id: string
  user_id: string
  name: string
  description: string | null
  logo_url: string | null
  status: string
  rating: number | null
  created_at: string
}

export interface VendorChecklistItem {
  key: string
  label: string
  ok: boolean
  required: boolean
  detail: string | null
}

/** GET /admin/vendors/{id}: everything needed to decide on an application. */
export interface VendorProfile {
  id: string
  name: string
  slug: string
  status: string
  description: string | null
  logo_url: string | null
  is_open: boolean
  created_at: string
  address: string | null
  street: string | null
  city: string | null
  lga: string | null
  state: string | null
  country: string | null
  landmark: string | null
  lat: number | null
  lng: number | null
  owner_name: string | null
  owner_email: string | null
  owner_phone: string | null
  owner_status: string | null
  payout_bank_name: string | null
  payout_account_name: string | null
  payout_account_last4: string | null
  product_total: number
  product_approved: number
  product_pending: number
  checklist: VendorChecklistItem[]
  /** Labels of required items that are not done yet. */
  missing: string[]
  unread_from_vendor: number
}

export interface VendorMessage {
  id: string
  sender_role: 'admin' | 'vendor'
  body: string
  created_at: string
  read: boolean
}
