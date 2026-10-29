import type { ProductListing } from '../products/types'
import type { Vendor } from '../vendors/types'

export interface SearchResults {
  products: ProductListing[]
  vendors: Vendor[]
  query: string
  type: 'products' | 'vendors' | 'all'
}
