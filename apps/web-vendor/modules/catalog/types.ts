export interface Product {
  id: string
  vendor_id: string
  category_id: string | null
  category_name: string | null
  name: string
  description: string | null
  price_kobo: number
  // PENDING until an admin approves it and sets the price customers see.
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejection_reason?: string | null
  available: boolean
  stock_qty: number
  image_urls: string[]
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
}

export interface VendorProfile {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  status: string
  zone_id: string | null
  rating: number
  products: Product[]
}
