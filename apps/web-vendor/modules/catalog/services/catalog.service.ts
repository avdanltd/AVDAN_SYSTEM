import { apiClient } from '@/lib/api-client'
import type { Product, VendorProfile } from '../types'

export interface CreateProductPayload {
  name: string
  description?: string
  price_kobo: number
  stock_qty: number
  available: boolean
}

export interface UpdateProductPayload {
  name?: string
  description?: string
  price_kobo?: number
  stock_qty?: number
  available?: boolean
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
