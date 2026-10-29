export interface AdminProduct {
  id: string
  vendor_id: string
  vendor_name: string
  category_name: string | null
  name: string
  description: string | null
  image_urls: string[]
  stock_qty: number
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejection_reason: string | null
  vendor_price_kobo: number
  price_kobo: number
  compare_at_price_kobo: number | null
  discount_type: 'FIXED' | 'PERCENT' | null
  discount_value: number | null
  markup_kobo: number
  created_at: string
}
