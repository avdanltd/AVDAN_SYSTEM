export interface Vendor {
  id: string
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  rating: number | null
  status: string
  zone_id: string | null
  created_at: string
}

export interface Product {
  id: string
  vendor_id: string
  name: string
  description: string | null
  price_kobo: number
  available: boolean
  stock_qty: number
  image_urls: string[]
}

export interface VendorWithProducts extends Vendor {
  products: Product[]
}
