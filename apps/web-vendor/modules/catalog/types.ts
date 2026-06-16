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
