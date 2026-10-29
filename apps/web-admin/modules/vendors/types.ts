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
