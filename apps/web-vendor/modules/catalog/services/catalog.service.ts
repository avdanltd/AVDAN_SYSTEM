import { apiClient } from '@/lib/api-client'
import type { Product, VendorProfile } from '../types'

// Mirrors CreateProductRequest/UpdateProductRequest in services/vendor/schemas.py — both accept
// category_id and image_urls; category_id is required by the form (product-form.tsx) and was
// missing here even though it's already sent in the actual request payload.
export interface CreateProductPayload {
  name: string
  description?: string
  price_kobo: number
  stock_qty: number
  available: boolean
  category_id?: string
  image_urls?: string[]
}

export interface UpdateProductPayload {
  name?: string
  description?: string
  price_kobo?: number
  stock_qty?: number
  available?: boolean
  category_id?: string
  image_urls?: string[]
}

export const catalogService = {
  getVendorProfile: () => apiClient.get<VendorProfile>('/vendors/me'),

  createProduct: (data: CreateProductPayload) =>
    apiClient.post<Product>('/vendors/me/products', data),

  updateProduct: (id: string, data: UpdateProductPayload) =>
    apiClient.patch<Product>(`/vendors/me/products/${id}`, data),

  toggleAvailability: (id: string, available: boolean) =>
    apiClient.patch<Product>(`/vendors/me/products/${id}/availability`, { available }),

  deleteProduct: (id: string) =>
    apiClient.delete<{ message: string }>(`/vendors/me/products/${id}`),
}
