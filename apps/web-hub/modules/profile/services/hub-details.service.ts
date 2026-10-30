import { apiClient } from '@/lib/api-client'

export interface MyHub {
  id: string
  name: string
  active: boolean
  capacity: number
  lat: number | null
  lng: number | null
  address: string | null
  description: string | null
}

export interface UpdateMyHubPayload {
  address?: string
  description?: string
  lat?: number
  lng?: number
}

export const hubDetailsService = {
  getMyHub: () => apiClient.get<MyHub>('/hub/me'),
  updateMyHub: (payload: UpdateMyHubPayload) => apiClient.patch<MyHub>('/hub/me', payload),
}
