import { apiClient } from '@/lib/api-client'

export interface MyHub {
  id: string
  name: string
  active: boolean
  capacity: number
  lat: number | null
  lng: number | null
  address: string | null
  street: string | null
  city: string | null
  state: string | null
  lga: string | null
  landmark: string | null
  description: string | null
}

export interface UpdateMyHubPayload {
  street?: string
  city?: string
  state?: string
  lga?: string
  landmark?: string
  description?: string
  lat?: number
  lng?: number
}

export const hubDetailsService = {
  getMyHub: () => apiClient.get<MyHub>('/hub/me'),
  updateMyHub: (payload: UpdateMyHubPayload) => apiClient.patch<MyHub>('/hub/me', payload),
}
