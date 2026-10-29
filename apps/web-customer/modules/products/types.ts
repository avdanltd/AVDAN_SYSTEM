export interface ProductListing {
  id: string
  vendor_id: string
  vendor_name: string
  vendor_slug: string
  category_id: string | null
  category_name: string | null
  name: string
  description: string | null
  price_kobo: number
  // Pre-discount price, shown struck through, when the platform has discounted this product.
  compare_at_price_kobo?: number | null
  available: boolean
  stock_qty: number
  image_urls: string[]
  created_at: string
}

export interface ProductDetail extends ProductListing {
  related_products: ProductListing[]
}

export interface ProductsParams {
  page?: number
  limit?: number
  category_id?: string
  vendor_id?: string
  search?: string
  min_price_kobo?: number
  max_price_kobo?: number
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular'
}
