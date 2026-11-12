export interface Vendor {
  id: string
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  rating: number | null
  review_count?: number
  status: string
  city?: string | null
  state?: string | null
  /** The vendor's own on/off switch; undefined on older responses means open. */
  is_open?: boolean
  /** Straight-line km from the customer; only present when listed nearest-first. */
  distance_km?: number | null
  zone_id: string | null
  created_at: string
}

export interface Product {
  id: string
  vendor_id: string
  name: string
  description: string | null
  price_kobo: number
  // Pre-discount price, shown struck through, when the platform has discounted this product.
  compare_at_price_kobo?: number | null
  available: boolean
  stock_qty: number
  image_urls: string[]
}

export interface VendorWithProducts extends Vendor {
  products: Product[]
}
