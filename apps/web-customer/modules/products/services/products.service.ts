import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@avdan/types'
import type { ProductDetail, ProductListing, ProductsParams } from '../types'

export const productsService = {
  getProducts: (params?: ProductsParams) => {
    const query: Record<string, string> = {}
    if (params?.page) query.page = String(params.page)
    if (params?.limit) query.page_size = String(params.limit)
    if (params?.category_id) query.category_id = params.category_id
    if (params?.vendor_id) query.vendor_id = params.vendor_id
    if (params?.search) query.search = params.search
    if (params?.min_price_kobo) query.min_price_kobo = String(params.min_price_kobo)
    if (params?.max_price_kobo) query.max_price_kobo = String(params.max_price_kobo)
    if (params?.sort) query.sort = params.sort
    return apiClient.get<PaginatedResponse<ProductListing>>('/products', Object.keys(query).length ? query : undefined)
  },
  getProduct: (id: string) => apiClient.get<ProductDetail>(`/products/${id}`),
}
